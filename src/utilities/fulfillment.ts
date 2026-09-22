import type { BeforeInitiatePaymentHook } from '@payloadcms/plugin-ecommerce/types'
import type { CollectionBeforeChangeHook, CollectionBeforeValidateHook } from 'payload'
import { APIError } from 'payload'

import type { Cart, Order, Transaction } from '@/payload-types'
import { resolveRelationID } from '@/utilities/resolveRelationID'

export type PickupContact = {
  firstName?: null | string
  lastName?: null | string
  phone?: null | string
}

export const DEFAULT_PICKUP_LABEL = 'Local pickup'
export const DEFAULT_PICKUP_CHECKOUT_DESCRIPTION =
  'Pickup details will be sent to you when your order is ready for collection.'

export type PublicPickupSettings = {
  pickupCheckoutDescription: string
  pickupEnabled: boolean
  pickupLabel: string
}

const clean = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  return value.trim() || undefined
}

export const resolvePublicPickupSettings = (settings: unknown): PublicPickupSettings => {
  const source =
    settings && typeof settings === 'object' ? (settings as Record<string, unknown>) : {}

  return {
    pickupCheckoutDescription:
      clean(source.pickupCheckoutDescription) || DEFAULT_PICKUP_CHECKOUT_DESCRIPTION,
    pickupEnabled: source.pickupEnabled !== false,
    pickupLabel: clean(source.pickupLabel) || DEFAULT_PICKUP_LABEL,
  }
}

export const normalizePickupContact = (contact: unknown): PickupContact => {
  if (!contact || typeof contact !== 'object') return {}

  const source = contact as Record<string, unknown>
  return {
    firstName: clean(source.firstName),
    lastName: clean(source.lastName),
    phone: clean(source.phone),
  }
}

export const isCompletePickupContact = (contact: unknown): boolean => {
  const normalized = normalizePickupContact(contact)
  return Boolean(normalized.firstName && normalized.lastName && normalized.phone)
}

export const getFulfillmentStatusLabel = (
  order: Pick<Order, 'fulfillmentMethod' | 'readyForPickup' | 'status'>,
): string | undefined => {
  if (order.fulfillmentMethod !== 'pickup') return undefined

  if (order.status === 'processing') {
    return order.readyForPickup ? 'Ready for pickup' : 'Preparing for pickup'
  }

  if (order.status === 'completed') return 'Picked up / completed'

  return undefined
}

export const validatePickupPayment: BeforeInitiatePaymentHook = async ({
  cart,
  req,
  shippingAddress,
  summary,
}) => {
  if (shippingAddress && Object.values(shippingAddress).some(Boolean)) {
    throw new APIError('Shipping is not currently available. Please choose local pickup.', 400)
  }

  const [fullCart, settings] = await Promise.all([
    req.payload.findByID({
      collection: 'carts',
      id: cart.id,
      depth: 0,
      overrideAccess: true,
      req,
    }),
    req.payload.findGlobal({
      slug: 'fulfillmentSettings',
      depth: 0,
      overrideAccess: true,
      req,
    }),
  ])
  const fulfillmentCart = fullCart as Cart

  if (!settings.pickupEnabled) {
    throw new APIError('Pickup checkout is currently unavailable.', 400)
  }

  if (fulfillmentCart.fulfillmentMethod !== 'pickup') {
    throw new APIError('Local pickup is the only available fulfillment method.', 400)
  }

  if (!isCompletePickupContact(fulfillmentCart.pickupContact)) {
    throw new APIError('First name, last name, and phone are required for pickup.', 400)
  }

  return summary
}

export const snapshotCartFulfillment: CollectionBeforeValidateHook<Transaction> = async ({
  data,
  operation,
  req,
}) => {
  if (operation !== 'create' || !data?.cart) return data

  const cartID = resolveRelationID(data.cart)
  if (!cartID) return data

  const cart = (await req.payload.findByID({
    collection: 'carts',
    id: cartID,
    depth: 0,
    overrideAccess: true,
    req,
  })) as Cart

  return {
    ...data,
    fulfillmentMethod: cart.fulfillmentMethod || 'pickup',
    pickupContact: normalizePickupContact(cart.pickupContact),
  }
}

const firstRelationID = (value: unknown): Order['id'] | undefined => {
  if (!Array.isArray(value) || value.length === 0) return undefined
  const id = resolveRelationID(value[0])

  if (typeof id === 'number') return id
  if (typeof id === 'string' && /^\d+$/.test(id)) return Number(id)

  return undefined
}

export const snapshotTransactionFulfillment: CollectionBeforeValidateHook<Order> = async ({
  data,
  operation,
  req,
}) => {
  if (operation !== 'create' || !data) return data

  const transactionID = firstRelationID(data.transactions)
  if (!transactionID) return data

  const transaction = (await req.payload.findByID({
    collection: 'transactions',
    id: transactionID,
    depth: 0,
    overrideAccess: true,
    req,
  })) as Transaction

  return {
    ...data,
    fulfillmentMethod: transaction.fulfillmentMethod || 'pickup',
    pickupContact: normalizePickupContact(transaction.pickupContact),
  }
}

export const prepareReadyForPickup: CollectionBeforeChangeHook<Order> = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  if (operation !== 'update' || !data) return data

  const wasReady = Boolean(originalDoc?.readyForPickup)
  const willBeReady = data.readyForPickup ?? originalDoc?.readyForPickup

  if (wasReady && willBeReady === false) {
    throw new APIError('An order cannot be moved out of ready-for-pickup state.', 400)
  }

  if (wasReady || !willBeReady) return data

  const method = data.fulfillmentMethod ?? originalDoc?.fulfillmentMethod
  const status = data.status ?? originalDoc?.status

  if (method !== 'pickup') {
    throw new APIError('Only pickup orders can be marked ready for pickup.', 400)
  }

  if (status !== 'processing') {
    throw new APIError('Only processing orders can be marked ready for pickup.', 400)
  }

  const settings = await req.payload.findGlobal({
    slug: 'fulfillmentSettings',
    depth: 0,
    overrideAccess: true,
    req,
  })
  const instructions = clean(settings.pickupReadyInstructions)

  if (!instructions) {
    throw new APIError(
      'Configure ready-for-pickup instructions before marking an order ready.',
      400,
    )
  }

  return {
    ...data,
    pickupInstructionsSnapshot: instructions,
    readyForPickup: true,
    readyForPickupAt: new Date().toISOString(),
  }
}
