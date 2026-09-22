import type { PayloadRequest } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { FulfillmentSettings } from '@/globals/FulfillmentSettings'
import {
  sendOrderReadyForPickupEmail,
  SKIP_PICKUP_READY_EMAIL_CONTEXT,
} from '@/collections/Orders/hooks/sendOrderReadyForPickupEmail'
import { fulfillmentFields } from '@/fields/fulfillment'
import {
  getFulfillmentStatusLabel,
  prepareReadyForPickup,
  resolvePublicPickupSettings,
  snapshotCartFulfillment,
  snapshotTransactionFulfillment,
  validatePickupPayment,
} from '@/utilities/fulfillment'

const paymentArgs = ({
  cart = { id: 10 },
  fullCart = {
    fulfillmentMethod: 'pickup',
    id: 10,
    pickupContact: { firstName: ' Ada ', lastName: ' Lovelace ', phone: ' 555-0100 ' },
  },
  pickupEnabled = true,
  shippingAddress,
}: {
  cart?: Record<string, unknown>
  fullCart?: Record<string, unknown>
  pickupEnabled?: boolean
  shippingAddress?: Record<string, unknown>
} = {}) => {
  const summary = { currency: 'CAD', lines: [], total: 2500 }
  const req = {
    payload: {
      findByID: vi.fn().mockResolvedValue(fullCart),
      findGlobal: vi.fn().mockResolvedValue({ pickupEnabled }),
    },
  } as unknown as PayloadRequest

  return {
    args: { cart, req, shippingAddress, summary } as unknown as Parameters<
      typeof validatePickupPayment
    >[0],
    req,
    summary,
  }
}

describe('pickup fulfillment', () => {
  it('allows shipping only on read-only legacy snapshots', () => {
    const cartMethod = fulfillmentFields().find(
      (field) => 'name' in field && field.name === 'fulfillmentMethod',
    )
    const snapshotMethod = fulfillmentFields({ includeLegacyShipping: true, readOnly: true }).find(
      (field) => 'name' in field && field.name === 'fulfillmentMethod',
    )

    expect(cartMethod).toMatchObject({
      options: [{ value: 'pickup' }],
    })
    expect(snapshotMethod).toMatchObject({
      admin: { readOnly: true },
      options: [{ value: 'pickup' }, { value: 'shipping' }],
    })
  })

  it('uses pickup statuses only for pickup orders', () => {
    expect(
      getFulfillmentStatusLabel({
        fulfillmentMethod: 'pickup',
        readyForPickup: false,
        status: 'processing',
      }),
    ).toBe('Preparing for pickup')
    expect(
      getFulfillmentStatusLabel({
        fulfillmentMethod: 'pickup',
        readyForPickup: true,
        status: 'processing',
      }),
    ).toBe('Ready for pickup')
    expect(
      getFulfillmentStatusLabel({
        fulfillmentMethod: 'shipping',
        readyForPickup: false,
        status: 'processing',
      }),
    ).toBeUndefined()
  })

  it('returns only public-safe checkout settings', () => {
    expect(
      resolvePublicPickupSettings({
        pickupCheckoutDescription: 'Collect after receiving an email.',
        pickupEnabled: true,
        pickupLabel: 'Studio pickup',
        pickupReadyInstructions: 'Private exact address',
      }),
    ).toEqual({
      pickupCheckoutDescription: 'Collect after receiving an email.',
      pickupEnabled: true,
      pickupLabel: 'Studio pickup',
    })
  })

  it('denies anonymous access to the fulfillment settings Global', async () => {
    const read = FulfillmentSettings.access?.read
    expect(read).toBeTypeOf('function')

    const result = await read?.({
      req: { user: null },
    } as unknown as Parameters<Exclude<typeof read, undefined>>[0])

    expect(result).toBe(false)
  })

  it('allows payment only after reloading a complete pickup cart', async () => {
    const { args, req, summary } = paymentArgs()

    await expect(validatePickupPayment(args)).resolves.toEqual(summary)
    expect(req.payload.findByID).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'carts', id: 10, overrideAccess: true }),
    )
  })

  it.each([
    [
      'disabled pickup',
      paymentArgs({ pickupEnabled: false }).args,
      'Pickup checkout is currently unavailable.',
    ],
    [
      'an unsupported method',
      paymentArgs({ fullCart: { fulfillmentMethod: 'shipping', id: 10 } }).args,
      'Local pickup is the only available fulfillment method.',
    ],
    [
      'an incomplete contact',
      paymentArgs({
        fullCart: {
          fulfillmentMethod: 'pickup',
          id: 10,
          pickupContact: { firstName: 'Ada', lastName: '', phone: '555-0100' },
        },
      }).args,
      'First name, last name, and phone are required for pickup.',
    ],
    [
      'a submitted shipping address',
      paymentArgs({ shippingAddress: { city: 'Vancouver' } }).args,
      'Shipping is not currently available. Please choose local pickup.',
    ],
  ])('rejects %s before payment initiation', async (_label, args, message) => {
    await expect(validatePickupPayment(args)).rejects.toMatchObject({
      message,
      status: 400,
    })
  })

  it('snapshots pickup data from cart to transaction and transaction to order', async () => {
    const findByID = vi
      .fn()
      .mockResolvedValueOnce({
        fulfillmentMethod: 'pickup',
        pickupContact: { firstName: ' Ada ', lastName: ' Lovelace ', phone: ' 555-0100 ' },
      })
      .mockResolvedValueOnce({
        fulfillmentMethod: 'pickup',
        pickupContact: { firstName: 'Ada', lastName: 'Lovelace', phone: '555-0100' },
      })
    const req = { payload: { findByID } } as unknown as PayloadRequest

    const transaction = await snapshotCartFulfillment({
      data: { cart: 10 },
      operation: 'create',
      req,
    } as unknown as Parameters<typeof snapshotCartFulfillment>[0])
    const order = await snapshotTransactionFulfillment({
      data: { transactions: [20] },
      operation: 'create',
      req,
    } as unknown as Parameters<typeof snapshotTransactionFulfillment>[0])

    expect(transaction).toMatchObject({
      fulfillmentMethod: 'pickup',
      pickupContact: { firstName: 'Ada', lastName: 'Lovelace', phone: '555-0100' },
    })
    expect(order).toMatchObject({
      fulfillmentMethod: 'pickup',
      pickupContact: { firstName: 'Ada', lastName: 'Lovelace', phone: '555-0100' },
    })
  })

  it('preserves a legacy shipping transaction on its order', async () => {
    const req = {
      payload: {
        findByID: vi.fn().mockResolvedValue({ fulfillmentMethod: 'shipping' }),
      },
    } as unknown as PayloadRequest

    const order = await snapshotTransactionFulfillment({
      data: { transactions: [20] },
      operation: 'create',
      req,
    } as unknown as Parameters<typeof snapshotTransactionFulfillment>[0])

    expect(order).toMatchObject({ fulfillmentMethod: 'shipping', pickupContact: {} })
  })

  it('freezes current instructions on the one-way ready transition', async () => {
    const req = {
      payload: {
        findGlobal: vi.fn().mockResolvedValue({
          pickupReadyInstructions: '  Use the side entrance after 10:00.  ',
        }),
      },
    } as unknown as PayloadRequest

    const readyOrder = await prepareReadyForPickup({
      data: { readyForPickup: true },
      operation: 'update',
      originalDoc: { fulfillmentMethod: 'pickup', readyForPickup: false, status: 'processing' },
      req,
    } as unknown as Parameters<typeof prepareReadyForPickup>[0])

    expect(readyOrder).toMatchObject({
      pickupInstructionsSnapshot: 'Use the side entrance after 10:00.',
      readyForPickup: true,
    })
    expect(readyOrder?.readyForPickupAt).toEqual(expect.any(String))

    await expect(
      prepareReadyForPickup({
        data: { readyForPickup: false },
        operation: 'update',
        originalDoc: { readyForPickup: true },
        req,
      } as unknown as Parameters<typeof prepareReadyForPickup>[0]),
    ).rejects.toThrow('An order cannot be moved out of ready-for-pickup state.')
  })

  it('requires processing pickup orders and configured instructions before ready', async () => {
    const req = {
      payload: { findGlobal: vi.fn().mockResolvedValue({ pickupReadyInstructions: ' ' }) },
    } as unknown as PayloadRequest

    await expect(
      prepareReadyForPickup({
        data: { readyForPickup: true },
        operation: 'update',
        originalDoc: { fulfillmentMethod: 'pickup', readyForPickup: false, status: 'completed' },
        req,
      } as unknown as Parameters<typeof prepareReadyForPickup>[0]),
    ).rejects.toThrow('Only processing orders can be marked ready for pickup.')

    await expect(
      prepareReadyForPickup({
        data: { readyForPickup: true },
        operation: 'update',
        originalDoc: { fulfillmentMethod: 'pickup', readyForPickup: false, status: 'processing' },
        req,
      } as unknown as Parameters<typeof prepareReadyForPickup>[0]),
    ).rejects.toThrow('Configure ready-for-pickup instructions')
  })

  it('records delivery and skips an already-sent ready email', async () => {
    const sendEmail = vi.fn().mockResolvedValue(undefined)
    const update = vi.fn().mockResolvedValue(undefined)
    const req = {
      payload: {
        findGlobal: vi.fn().mockResolvedValue({ pickupLabel: 'Studio collection' }),
        logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
        sendEmail,
        update,
      },
    } as unknown as PayloadRequest
    const doc = {
      accessToken: 'guest-secret',
      customerEmail: 'guest@example.com',
      fulfillmentMethod: 'pickup',
      id: 123,
      pickupInstructionsSnapshot: 'Use the side entrance.',
      readyForPickup: true,
    }

    await sendOrderReadyForPickupEmail({
      doc,
      req,
    } as unknown as Parameters<typeof sendOrderReadyForPickupEmail>[0])
    await sendOrderReadyForPickupEmail({
      doc: { ...doc, readyForPickupEmailSentAt: new Date().toISOString() },
      req,
    } as unknown as Parameters<typeof sendOrderReadyForPickupEmail>[0])

    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining('guest-secret'),
        to: 'guest@example.com',
      }),
    )
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'orders',
        context: { [SKIP_PICKUP_READY_EMAIL_CONTEXT]: true },
        data: { readyForPickupEmailSentAt: expect.any(String) },
        id: 123,
        overrideAccess: true,
        req,
      }),
    )
  })

  it('retries a ready email after a delivery failure', async () => {
    const sendEmail = vi
      .fn()
      .mockRejectedValueOnce(new Error('SMTP unavailable'))
      .mockResolvedValueOnce(undefined)
    const update = vi.fn().mockResolvedValue(undefined)
    const logger = { error: vi.fn(), info: vi.fn(), warn: vi.fn() }
    const req = {
      payload: {
        findGlobal: vi.fn().mockResolvedValue({ pickupLabel: 'Studio collection' }),
        logger,
        sendEmail,
        update,
      },
    } as unknown as PayloadRequest
    const doc = {
      customerEmail: 'guest@example.com',
      fulfillmentMethod: 'pickup',
      id: 123,
      pickupInstructionsSnapshot: 'Use the side entrance.',
      readyForPickup: true,
    }

    await sendOrderReadyForPickupEmail({ doc, req } as unknown as Parameters<
      typeof sendOrderReadyForPickupEmail
    >[0])
    await sendOrderReadyForPickupEmail({ doc, req } as unknown as Parameters<
      typeof sendOrderReadyForPickupEmail
    >[0])

    expect(sendEmail).toHaveBeenCalledTimes(2)
    expect(update).toHaveBeenCalledTimes(1)
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ msg: 'Failed to send pickup-ready email', orderID: 123 }),
    )
  })

  it('does not recurse while recording ready-email delivery', async () => {
    const sendEmail = vi.fn()
    const req = {
      context: { [SKIP_PICKUP_READY_EMAIL_CONTEXT]: true },
      payload: { sendEmail },
    } as unknown as PayloadRequest

    await sendOrderReadyForPickupEmail({
      doc: { fulfillmentMethod: 'pickup', id: 123, readyForPickup: true },
      req,
    } as unknown as Parameters<typeof sendOrderReadyForPickupEmail>[0])

    expect(sendEmail).not.toHaveBeenCalled()
  })
})
