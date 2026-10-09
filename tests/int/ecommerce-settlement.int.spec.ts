// @vitest-environment node
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { createLocalReq, getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const stripeState = vi.hoisted(() => ({
  intents: new Map<string, Record<string, unknown>>(),
}))

vi.mock('stripe', () => ({
  default: class {
    customers = {
      list: async () => ({ data: [{ id: 'cus-settlement' }] }),
    }
    paymentIntents = {
      create: async (data: Record<string, unknown>) => {
        const intent = {
          ...data,
          id: `pi_${stripeState.intents.size}`,
          status: 'succeeded',
          client_secret: 'test-secret',
        }
        stripeState.intents.set(intent.id, intent)
        return intent
      },
      retrieve: async (id: string) => stripeState.intents.get(id),
    }
  },
}))

import config from '@/payload.config'
import { currenciesConfig } from '@/config/currencies'
import { validatePickupPayment } from '@/utilities/fulfillment'
import { applyCouponDiscount, recordCouponRedemption } from '@/utilities/coupons'
import { stripeAdapter } from '@payloadcms/plugin-ecommerce/payments/stripe'
import { initiatePaymentHandler } from '../../packages/plugin-ecommerce/dist/endpoints/initiatePayment.js'
import { confirmOrderHandler } from '../../packages/plugin-ecommerce/dist/endpoints/confirmOrder.js'

let payload: Payload
let directory: string

const adapter = stripeAdapter({
  secretKey: 'sk_test_settlement',
  publishableKey: 'pk_test_settlement',
})
const initiate = initiatePaymentHandler({
  currenciesConfig,
  hasHooks: true,
  paymentHooks: { beforeInitiatePayment: [validatePickupPayment, applyCouponDiscount] },
  paymentMethod: adapter,
})
const confirm = confirmOrderHandler({
  currenciesConfig,
  hasHooks: true,
  paymentHooks: { afterConfirmOrder: [recordCouponRedemption] },
  paymentMethod: adapter,
})

const request = async (data: Record<string, unknown>) => {
  const req = await createLocalReq({ context: { disableRevalidate: true } }, payload)
  req.data = data
  return req
}

describe('vendored ecommerce settlement with the website SQLite schema', () => {
  beforeAll(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'quotify3d-settlement-'))
    const db = sqliteAdapter({ client: { url: `file:${directory}/test.db` } })
    payload = await getPayload({
      key: 'ecommerce-settlement-tests',
      config: {
        ...(await config),
        db: {
          ...db,
          name: db.name ?? 'sqlite',
          allowIDOnCreate: db.allowIDOnCreate ?? false,
          defaultIDType: db.defaultIDType ?? 'number',
        },
        jobs: { ...(await config).jobs, autoRun: [] },
      },
    })
    vi.spyOn(payload, 'sendEmail').mockResolvedValue(undefined)
  })

  afterAll(async () => {
    if (payload) await payload.destroy()
    if (directory) await rm(directory, { recursive: true, force: true })
  })

  it.each([1, 9])('settles and retries a guest pickup order with %i cart rows', async (rows) => {
    const product = await payload.create({
      collection: 'products',
      context: { disableRevalidate: true },
      data: {
        title: `Settlement fixture ${rows}`,
        slug: `settlement-fixture-${rows}`,
        _status: 'published',
        inventory: 20,
        priceInCADEnabled: true,
        priceInCAD: 1000,
      },
    })
    const coupon = await payload.create({
      collection: 'coupons',
      data: {
        title: `Test coupon ${rows}`,
        code: `TEST${rows}`,
        appliesTo: 'cart',
        discountType: 'percentage',
        percentOff: 10,
      },
    })
    const pickupContact = { firstName: 'Test', lastName: 'Buyer', phone: '555-0100' }
    const cart = await payload.create({
      collection: 'carts',
      data: {
        currency: 'CAD',
        couponCode: coupon.code,
        fulfillmentMethod: 'pickup',
        pickupContact,
        items: Array.from({ length: rows }, () => ({ product: product.id, quantity: 1 })),
      },
    })
    const paymentResponse = await initiate(
      await request({
        cartID: cart.id,
        secret: cart.secret,
        customerEmail: 'buyer@example.com',
      }),
    )
    expect(paymentResponse.status).toBe(200)
    const payment = await paymentResponse.json()
    const transaction = await payload.findByID({
      collection: 'transactions',
      id: payment.transactionID,
      depth: 0,
    })
    expect(transaction.items?.[0].id).not.toBe(cart.items?.[0].id)
    const intent = stripeState.intents.get(payment.paymentIntentID)!
    const metadata = intent.metadata as Record<string, string>
    expect(Boolean(metadata.cartItemsSnapshot)).toBe(rows === 1)

    const confirmationData = {
      cartID: cart.id,
      secret: cart.secret,
      customerEmail: 'buyer@example.com',
      paymentIntentID: payment.paymentIntentID,
    }
    const firstResponse = await confirm(await request(confirmationData))
    expect(firstResponse.status).toBe(200)
    const first = await firstResponse.json()
    const retryResponse = await confirm(await request(confirmationData))
    expect(retryResponse.status).toBe(200)
    expect(await retryResponse.json()).toEqual(first)

    const orders = await payload.find({
      collection: 'orders',
      where: { transactions: { equals: transaction.id } },
    })
    expect(orders.totalDocs).toBe(1)
    expect(orders.docs[0]).toMatchObject({
      fulfillmentMethod: 'pickup',
      pickupContact,
      summary: { total: rows * 900, currency: 'CAD' },
    })
    expect(first.summary.total).toBe(rows * 900)
    expect(first.summary.lines).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'discount', amount: -rows * 100 })]),
    )
    const redemptions = await payload.find({
      collection: 'coupon-redemptions',
      where: { transaction: { equals: transaction.id } },
    })
    expect(redemptions.totalDocs).toBe(1)
    expect(redemptions.docs[0].discountAmount).toBe(rows * 100)
    const settled = await payload.findByID({ collection: 'transactions', id: transaction.id })
    expect(settled.status).toBe('succeeded')
    const updatedProduct = await payload.findByID({ collection: 'products', id: product.id })
    expect(updatedProduct.inventory).toBe(20 - rows)
  })
})
