import type { CollectionBeforeChangeHook } from 'payload'

import { resolveRelationID } from '@/collections/Quotes/relations'

export const normalizeQuoteCustomer: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  req,
}) => {
  if (!data) return data

  const normalizedEmail =
    typeof data.customerEmail === 'string' ? data.customerEmail.trim().toLowerCase() : undefined

  if (!req.user && normalizedEmail) {
    data.customerEmail = normalizedEmail
  }

  const existingEmail =
    data.customerEmail ??
    (typeof originalDoc?.customerEmail === 'string' ? originalDoc.customerEmail : undefined)

  const existingCustomer =
    resolveRelationID(data.customer) ?? resolveRelationID(originalDoc?.customer)

  if (existingCustomer) {
    data.customer = existingCustomer
  }
  else if (existingEmail) {
    data.customerEmail = existingEmail
  }
  else if (req.user) {
    data.customer = req.user.id
  } else if (!existingCustomer && !existingEmail) {
    throw new Error('Please include a contact email so we can follow up about your quote.')
  }

  return data
}
