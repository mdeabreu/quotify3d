import type { CollectionAfterChangeHook } from 'payload'

import { resolveCustomerRecipient } from '@/utilities/email/resolveCustomerRecipient'
import { logSentEmail } from '@/utilities/email/logSentEmail'
import { getServerSideURL } from '@/utilities/getURL'
import { render } from '@react-email/components'
import QuoteCreatedEmail from 'emails/quote-created'

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

export const sendQuoteCreatedEmail: CollectionAfterChangeHook = async ({ doc, operation, req }) => {
  if (!doc || operation !== 'create') return doc

  try {
    const recipient = await resolveCustomerRecipient({
      customer: doc.customer,
      customerEmail: doc.customerEmail,
      req,
    })

    if (!recipient) {
      req.payload.logger.warn({
        msg: 'Skipping quote created email because no customer email could be resolved',
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
      subject: `Your quote #${doc.id} has been created`,
      html: await render(QuoteCreatedEmail({ quoteID: doc.id, quoteURL })),
    })

    logSentEmail({
      emailType: 'quote-created',
      logger: req.payload.logger,
      quoteID: doc.id,
      to: recipient.email,
      url: quoteURL,
    })
  } catch (err) {
    req.payload.logger.error({
      err,
      msg: 'Failed to send quote created email',
      quoteID: doc.id,
    })
  }

  return doc
}
