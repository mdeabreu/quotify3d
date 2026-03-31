'use server'

import configPromise from '@payload-config'
import { getPayload } from 'payload'

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

  try {
    const { docs: quotes } = await payload.find({
      collection: 'quotes',
      where: {
        and: [{ id: { equals: quoteID } }, { customerEmail: { equals: email } }],
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
    const quoteURL = `${serverURL}/quotes/${quote.id}?email=${encodeURIComponent(email)}&accessToken=${accessToken}`

    await payload.sendEmail({
      to: email,
      subject: `Access your quote #${quote.id}`,
      html: `
        <h1>View Your Quote</h1>
        <p>Click the link below to view your quote details:</p>
        <p><a href="${quoteURL}">View Quote #${quote.id}</a></p>
        <p>Or copy and paste this URL into your browser:</p>
        <p>${quoteURL}</p>
        <p>This link will give you access to view your quote details.</p>
      `,
    })

    return { success: true }
  } catch (err) {
    payload.logger.error({ msg: 'Failed to send quote access email', err })
    return { success: true }
  }
}
