import 'server-only'

import configPromise from '@payload-config'
import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'

import { findAccessibleQuote } from '@/lib/quotes/findAccessibleQuote'
import { isEditableQuoteStatus } from '@/lib/quotes/workspaceData'
import type { Quote, User } from '@/payload-types'

export const getQuoteActionContext = async (formData: FormData) => {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: await getHeaders() })
  const quoteID = Number.parseInt(String(formData.get('quoteID') ?? ''), 10)
  const customerEmail = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase()
  const accessToken = String(formData.get('accessToken') ?? '').trim()
  if (!Number.isInteger(quoteID) || quoteID < 1) return null

  const quote = await findAccessibleQuote({
    accessToken,
    customerEmail,
    payload,
    quoteID,
    user,
  })
  if (!quote || !isEditableQuoteStatus(quote.status)) return null

  return { accessToken, customerEmail, payload, quote, quoteID, user }
}

export const updateQuoteFromAction = async ({
  data,
  payload,
  quoteID,
  user,
}: {
  data: Record<string, unknown>
  payload: Awaited<ReturnType<typeof getPayload>>
  quoteID: number
  user: User | null
}): Promise<Quote> =>
  payload.update({
    collection: 'quotes',
    id: quoteID,
    user,
    overrideAccess: !Boolean(user),
    data: data as never,
  }) as Promise<Quote>
