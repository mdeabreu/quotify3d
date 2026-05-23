import type { CollectionAfterChangeHook } from 'payload'

import { resolveCustomerRecipient } from '@/utilities/email/resolveCustomerRecipient'
import { logSentEmail } from '@/utilities/email/logSentEmail'
import { getServerSideURL } from '@/utilities/getURL'
import { render } from '@react-email/components'
import OrderCreatedEmail from 'emails/order-created'

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

export const sendOrderCreatedEmail: CollectionAfterChangeHook = async ({ doc, operation, req }) => {
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
      html: await render(OrderCreatedEmail({ orderID: doc.id, orderURL })),
    })

    logSentEmail({
      emailType: 'order-created',
      logger: req.payload.logger,
      orderID: doc.id,
      to: recipient.email,
      url: orderURL,
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
