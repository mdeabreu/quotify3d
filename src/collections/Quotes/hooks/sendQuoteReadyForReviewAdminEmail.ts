import type { CollectionAfterChangeHook } from 'payload'

import { logSentEmail } from '@/utilities/email/logSentEmail'
import { resolveAdminRecipients } from '@/utilities/email/resolveAdminRecipients'
import { getServerSideURL } from '@/utilities/getURL'
import { render } from '@react-email/components'
import AdminQuoteReadyForReviewEmail from 'emails/admin-quote-ready-for-review'

const toOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export const sendQuoteReadyForReviewAdminEmail: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  req,
}) => {
  if (!doc || doc.status !== 'ready-for-review' || previousDoc?.status === 'ready-for-review') {
    return doc
  }

  try {
    const adminRecipients = await resolveAdminRecipients({ req })

    if (adminRecipients.length === 0) {
      req.payload.logger.warn({
        msg: 'Skipping quote ready-for-review admin email because no admin recipients were found',
        quoteID: doc.id,
      })
      return doc
    }

    const adminURL = `${getServerSideURL()}/admin/collections/quotes/${doc.id}`
    const customerEmail = toOptionalString(doc.customerEmail)
    const html = await render(
      AdminQuoteReadyForReviewEmail({
        adminURL,
        customerEmail,
        quoteID: doc.id,
      }),
    )

    for (const to of adminRecipients) {
      await req.payload.sendEmail({
        to,
        subject: `Quote #${doc.id} is ready for review`,
        html,
      })

      logSentEmail({
        emailType: 'admin-quote-ready-for-review',
        logger: req.payload.logger,
        quoteID: doc.id,
        to,
        url: adminURL,
      })
    }
  } catch (err) {
    req.payload.logger.error({
      err,
      msg: 'Failed to send quote ready-for-review admin email',
      quoteID: doc.id,
    })
  }

  return doc
}
