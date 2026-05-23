import type { CollectionAfterChangeHook } from 'payload'

import { logSentEmail } from '@/utilities/email/logSentEmail'
import { resolveAdminRecipients } from '@/utilities/email/resolveAdminRecipients'
import { getServerSideURL } from '@/utilities/getURL'
import { render } from '@react-email/components'
import AdminOrderCreatedEmail from 'emails/admin-order-created'

const toOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export const sendOrderCreatedAdminEmail: CollectionAfterChangeHook = async ({
  doc,
  operation,
  req,
}) => {
  if (!doc || operation !== 'create') return doc

  try {
    const adminRecipients = await resolveAdminRecipients({ req })

    if (adminRecipients.length === 0) {
      req.payload.logger.warn({
        msg: 'Skipping order created admin email because no admin recipients were found',
        orderID: doc.id,
      })
      return doc
    }

    const adminURL = `${getServerSideURL()}/admin/collections/orders/${doc.id}`
    const customerEmail = toOptionalString(doc.customerEmail)
    const html = await render(
      AdminOrderCreatedEmail({
        adminURL,
        customerEmail,
        orderID: doc.id,
      }),
    )

    for (const to of adminRecipients) {
      await req.payload.sendEmail({
        to,
        subject: `Order #${doc.id} has been created`,
        html,
      })

      logSentEmail({
        emailType: 'admin-order-created',
        logger: req.payload.logger,
        orderID: doc.id,
        to,
        url: adminURL,
      })
    }
  } catch (err) {
    req.payload.logger.error({
      err,
      msg: 'Failed to send order created admin email',
      orderID: doc.id,
    })
  }

  return doc
}
