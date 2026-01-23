import type { CollectionBeforeChangeHook } from 'payload'

import { resolveRelationID } from '@/utilities/resolveRelationID'

export const normalizeCustomerOrEmail: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  req,
}) => {
  if (!data) return data

  const normalizedEmail =
    typeof data.customerEmail === 'string' ? data.customerEmail.trim().toLowerCase() : undefined

  if (normalizedEmail) {
    data.customerEmail = normalizedEmail
  }

  const existingEmail =
    data.customerEmail ??
    (typeof originalDoc?.customerEmail === 'string' ? originalDoc.customerEmail : undefined)

  const existingCustomer = resolveRelationID(data.customer) ?? resolveRelationID(originalDoc?.customer)

  if (existingCustomer) {
    data.customer = existingCustomer
  } else if (existingEmail) {
    data.customerEmail = existingEmail
  } else if (req.user) {
    data.customer = req.user.id
  } else {
    throw new Error('Please provide a customer or contact email.')
  }

  return data
}
