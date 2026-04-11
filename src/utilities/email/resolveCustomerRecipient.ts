import type { PayloadRequest } from 'payload'

import { resolveRelationID } from '@/utilities/resolveRelationID'

const toOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export const resolveCustomerRecipient = async ({
  customer,
  customerEmail,
  req,
}: {
  customer: unknown
  customerEmail: unknown
  req: PayloadRequest
}): Promise<{ email: string; source: 'customer' | 'guest' } | null> => {
  const guestEmail = toOptionalString(customerEmail)

  if (guestEmail) {
    return {
      email: guestEmail,
      source: 'guest',
    }
  }

  const customerID = resolveRelationID(customer)

  if (!customerID) {
    return null
  }

  const user = await req.payload.findByID({
    collection: 'users',
    id: customerID,
    depth: 0,
    overrideAccess: true,
    req,
    select: {
      email: true,
    },
  })

  const accountEmail = toOptionalString(user.email)

  if (!accountEmail) {
    return null
  }

  return {
    email: accountEmail,
    source: 'customer',
  }
}
