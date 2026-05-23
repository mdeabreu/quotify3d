'use server'

import configPromise from '@payload-config'
import { render } from '@react-email/components'
import QuoteAccessEmail from 'emails/quote-access'
import { getPayload } from 'payload'

import { logSentEmail } from '@/utilities/email/logSentEmail'
import { getServerSideURL } from '@/utilities/getURL'

type SendQuoteAccessEmailArgs = {
  email: string
  quoteID: string
}

type SendQuoteAccessEmailResult = {
  success: boolean
  error?: string
}

export async function sendQuoteAccessEmail({
  email,
  quoteID,
}: SendQuoteAccessEmailArgs): Promise<SendQuoteAccessEmailResult> {
  const payload = await getPayload({ config: configPromise })
  const normalizedEmail = email.trim().toLowerCase()

  try {
    const { docs: quotes } = await payload.find({
      collection: 'quotes',
      where: {
        and: [{ id: { equals: quoteID } }, { customerEmail: { equals: normalizedEmail } }],
      },
      limit: 1,
      depth: 0,
    })

    const quote = quotes[0]

    const accessToken = quote && 'accessToken' in quote ? quote.accessToken : undefined

    if (!quote || !accessToken) {
      return { success: true }
    }

    const serverURL = getServerSideURL()
    const quoteURL = `${serverURL}/quotes/${quote.id}?email=${encodeURIComponent(normalizedEmail)}&accessToken=${accessToken}`

    await payload.sendEmail({
      to: normalizedEmail,
      subject: `Access your quote #${quote.id}`,
      html: await render(QuoteAccessEmail({ quoteID: quote.id, quoteURL })),
    })

    logSentEmail({
      emailType: 'quote-access',
      logger: payload.logger,
      quoteID: quote.id,
      to: normalizedEmail,
      url: quoteURL,
    })

    return { success: true }
  } catch (err) {
    payload.logger.error({ msg: 'Failed to send quote access email', err })
    return { success: true }
  }
}
