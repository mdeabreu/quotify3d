import type { PayloadRequest } from 'payload'

const toOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export const resolveAdminRecipients = async ({
  req,
}: {
  req: PayloadRequest
}): Promise<string[]> => {
  const result = await req.payload.find({
    collection: 'users',
    depth: 0,
    limit: 100,
    overrideAccess: true,
    req,
    select: {
      email: true,
    },
    where: {
      roles: {
        contains: 'admin',
      },
    },
  })

  return Array.from(
    new Set(
      result.docs
        .map((user) => toOptionalString(user.email)?.toLowerCase())
        .filter((email): email is string => Boolean(email)),
    ),
  )
}
