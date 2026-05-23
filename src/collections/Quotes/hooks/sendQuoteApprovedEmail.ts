import type { CollectionAfterChangeHook } from 'payload'

import { resolveCustomerRecipient } from '@/utilities/email/resolveCustomerRecipient'
import { logSentEmail } from '@/utilities/email/logSentEmail'
import { getServerSideURL } from '@/utilities/getURL'
import { render } from '@react-email/components'
import QuoteApprovedEmail from 'emails/quote-approved'

const toOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

const getQuoteURL = ({
  accessToken,
  customerEmail,
  quoteID,
  recipientSource,
}: {
  accessToken?: string
  customerEmail?: string
  quoteID: number
  recipientSource: 'customer' | 'guest'
}) => {
  const serverURL = getServerSideURL()

  if (recipientSource === 'guest' && customerEmail && accessToken) {
    const queryParams = new URLSearchParams({
      accessToken,
      email: customerEmail,
    })

    return `${serverURL}/quotes/${quoteID}?${queryParams.toString()}`
  }

  return `${serverURL}/quotes/${quoteID}`
}

export const sendQuoteApprovedEmail: CollectionAfterChangeHook = async ({
  doc,
  operation,
  previousDoc,
  req,
}) => {
  if (!doc) return doc

  const movedToApproved =
    doc.status === 'approved' && (operation === 'create' || previousDoc?.status !== 'approved')

  if (!movedToApproved) {
    return doc
  }

  try {
    const recipient = await resolveCustomerRecipient({
      customer: doc.customer,
      customerEmail: doc.customerEmail,
      req,
    })

    if (!recipient) {
      req.payload.logger.warn({
        msg: 'Skipping quote approved email because no customer email could be resolved',
        quoteID: doc.id,
      })
      return doc
    }

    const quoteURL = getQuoteURL({
      accessToken: toOptionalString(doc.accessToken),
      customerEmail: recipient.source === 'guest' ? recipient.email : undefined,
      quoteID: doc.id,
      recipientSource: recipient.source,
    })

    await req.payload.sendEmail({
      to: recipient.email,
      subject: `Your quote #${doc.id} is approved`,
      html: await render(QuoteApprovedEmail({ quoteID: doc.id, quoteURL })),
    })

    logSentEmail({
      emailType: 'quote-approved',
      logger: req.payload.logger,
      quoteID: doc.id,
      to: recipient.email,
      url: quoteURL,
    })
  } catch (err) {
    req.payload.logger.error({
      err,
      msg: 'Failed to send quote approved email',
      quoteID: doc.id,
    })
  }

  return doc
}
