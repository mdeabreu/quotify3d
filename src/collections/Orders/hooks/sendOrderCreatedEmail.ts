import type { CollectionAfterChangeHook } from 'payload'

import { resolveCustomerRecipient } from '@/utilities/email/resolveCustomerRecipient'
import { getServerSideURL } from '@/utilities/getURL'

const toOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

const getOrderURL = ({
  accessToken,
  customerEmail,
  orderID,
  recipientSource,
}: {
  accessToken?: string
  customerEmail?: string
  orderID: number
  recipientSource: 'customer' | 'guest'
}) => {
  const serverURL = getServerSideURL()

  if (recipientSource === 'guest' && customerEmail && accessToken) {
    const queryParams = new URLSearchParams({
      accessToken,
      email: customerEmail,
    })

    return `${serverURL}/orders/${orderID}?${queryParams.toString()}`
  }

  return `${serverURL}/orders/${orderID}`
}

export const sendOrderCreatedEmail: CollectionAfterChangeHook = async ({
  doc,
  operation,
  req,
}) => {
  if (!doc || operation !== 'create') return doc

  try {
    const recipient = await resolveCustomerRecipient({
      customer: doc.customer,
      customerEmail: doc.customerEmail,
      req,
    })

    if (!recipient) {
      req.payload.logger.warn({
        msg: 'Skipping order created email because no customer email could be resolved',
        orderID: doc.id,
      })
      return doc
    }

    const orderURL = getOrderURL({
      accessToken: toOptionalString('accessToken' in doc ? doc.accessToken : undefined),
      customerEmail: recipient.source === 'guest' ? recipient.email : undefined,
      orderID: doc.id,
      recipientSource: recipient.source,
    })

    await req.payload.sendEmail({
      to: recipient.email,
      subject: `Your order #${doc.id} has been placed`,
      html: `
        <h1>Your order has been placed</h1>
        <p>Your order #${doc.id} has been placed successfully.</p>
        <p>You can use the link below to come back and review your order details at any time.</p>
        <p><a href="${orderURL}">View order #${doc.id}</a></p>
        <p>If the button above does not work, copy and paste this link into your browser:</p>
        <p>${orderURL}</p>
      `,
    })
  } catch (err) {
    req.payload.logger.error({
      err,
      msg: 'Failed to send order created email',
      orderID: doc.id,
    })
  }

  return doc
}
