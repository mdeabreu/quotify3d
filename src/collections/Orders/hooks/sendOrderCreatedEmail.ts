import type { CollectionAfterChangeHook } from 'payload'

import { resolveCustomerRecipient } from '@/utilities/email/resolveCustomerRecipient'
import { logSentEmail } from '@/utilities/email/logSentEmail'
import { DEFAULT_PICKUP_LABEL } from '@/utilities/fulfillment'
import { getOrderURL, toOptionalString } from '@/utilities/orders/getOrderURL'
import { render } from '@react-email/components'
import OrderCreatedEmail from 'emails/order-created'

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
    let pickupLabel: string | undefined

    if (doc.fulfillmentMethod === 'pickup') {
      const settings = await req.payload.findGlobal({
        slug: 'fulfillmentSettings',
        depth: 0,
        overrideAccess: true,
        req,
      })
      pickupLabel = toOptionalString(settings.pickupLabel) || DEFAULT_PICKUP_LABEL
    }

    await req.payload.sendEmail({
      to: recipient.email,
      subject: `Your order #${doc.id} has been placed`,
      html: await render(OrderCreatedEmail({ orderID: doc.id, orderURL, pickupLabel })),
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
