import type { CollectionAfterChangeHook } from 'payload'

import { resolveCustomerRecipient } from '@/utilities/email/resolveCustomerRecipient'
import { logSentEmail } from '@/utilities/email/logSentEmail'
import { DEFAULT_PICKUP_LABEL } from '@/utilities/fulfillment'
import { getOrderURL, toOptionalString } from '@/utilities/orders/getOrderURL'
import { render } from '@react-email/components'
import OrderReadyForPickupEmail from 'emails/order-ready-for-pickup'

export const SKIP_PICKUP_READY_EMAIL_CONTEXT = 'skipPickupReadyEmail'

export const sendOrderReadyForPickupEmail: CollectionAfterChangeHook = async ({
  doc,
  req,
}) => {
  if (
    doc?.fulfillmentMethod !== 'pickup' ||
    !doc?.readyForPickup ||
    doc.readyForPickupEmailSentAt ||
    req.context?.[SKIP_PICKUP_READY_EMAIL_CONTEXT]
  ) {
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
        msg: 'Skipping pickup-ready email because no customer email could be resolved',
        orderID: doc.id,
      })
      return doc
    }

    const settings = await req.payload.findGlobal({
      slug: 'fulfillmentSettings',
      depth: 0,
      overrideAccess: true,
      req,
    })
    const pickupLabel = toOptionalString(settings.pickupLabel) || DEFAULT_PICKUP_LABEL
    const instructions = toOptionalString(doc.pickupInstructionsSnapshot)

    if (!instructions) {
      req.payload.logger.warn({
        msg: 'Skipping pickup-ready email because the order has no instruction snapshot',
        orderID: doc.id,
      })
      return doc
    }

    const orderURL = getOrderURL({
      accessToken: toOptionalString(doc.accessToken),
      customerEmail: recipient.source === 'guest' ? recipient.email : undefined,
      orderID: doc.id,
      recipientSource: recipient.source,
    })

    await req.payload.sendEmail({
      to: recipient.email,
      subject: `Your order #${doc.id} is ready for pickup`,
      html: await render(
        OrderReadyForPickupEmail({ instructions, orderID: doc.id, orderURL, pickupLabel }),
      ),
    })

    await req.payload.update({
      collection: 'orders',
      id: doc.id,
      context: {
        [SKIP_PICKUP_READY_EMAIL_CONTEXT]: true,
      },
      data: {
        readyForPickupEmailSentAt: new Date().toISOString(),
      },
      overrideAccess: true,
      req,
    })

    logSentEmail({
      emailType: 'order-ready-for-pickup',
      logger: req.payload.logger,
      orderID: doc.id,
      to: recipient.email,
      url: orderURL,
    })
  } catch (err) {
    req.payload.logger.error({
      err,
      msg: 'Failed to send pickup-ready email',
      orderID: doc.id,
    })
  }

  return doc
}
