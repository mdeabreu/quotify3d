import type { Payload } from 'payload'

import { checkRole } from '@/access/utilities'
import type { User } from '@/payload-types'

export const findAccessibleQuote = async ({
  accessToken,
  customerEmail,
  depth = 2,
  payload,
  quoteID,
  user,
}: {
  accessToken: string
  customerEmail: string
  depth?: number
  payload: Payload
  quoteID: number | string
  user: User | null
}) => {
  const isAdmin = Boolean(user && checkRole(['admin'], user))
  if (!user && (!accessToken || !customerEmail)) return null

  const result = await payload.find({
    collection: 'quotes',
    user,
    overrideAccess: !Boolean(user),
    depth,
    limit: 1,
    where: {
      and: [
        { id: { equals: quoteID } },
        ...(isAdmin
          ? []
          : user
            ? [{ customer: { equals: user.id } }]
            : [
                { accessToken: { equals: accessToken } },
                { customerEmail: { equals: customerEmail } },
              ]),
      ],
    },
  })

  return result.docs[0] ?? null
}
