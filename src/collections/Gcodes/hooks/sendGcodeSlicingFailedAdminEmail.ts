import type { CollectionAfterChangeHook } from 'payload'

import { logSentEmail } from '@/utilities/email/logSentEmail'
import { resolveAdminRecipients } from '@/utilities/email/resolveAdminRecipients'
import { getServerSideURL } from '@/utilities/getURL'
import { resolveRelationID } from '@/utilities/resolveRelationID'
import { render } from '@react-email/components'
import AdminGcodeSlicingFailedEmail from 'emails/admin-gcode-slicing-failed'

const toOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export const sendGcodeSlicingFailedAdminEmail: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  req,
}) => {
  if (!doc || doc.status !== 'failed' || previousDoc?.status === 'failed') {
    return doc
  }

  const quoteID = resolveRelationID(doc.quote)
  const quoteItemID = toOptionalString(doc.quoteItemID)
  const error = toOptionalString(doc.error)

  req.payload.logger.error({
    error,
    gcodeID: doc.id,
    msg: 'Slicing failed',
    quoteID,
    quoteItemID,
  })

  try {
    const adminRecipients = await resolveAdminRecipients({ req })

    if (adminRecipients.length === 0) {
      req.payload.logger.warn({
        gcodeID: doc.id,
        msg: 'Skipping gcode slicing failed admin email because no admin recipients were found',
        quoteID,
        quoteItemID,
      })
      return doc
    }

    const adminURL = `${getServerSideURL()}/admin/collections/gcodes/${doc.id}`
    const html = await render(
      AdminGcodeSlicingFailedEmail({
        adminURL,
        error,
        gcodeID: doc.id,
        quoteID,
        quoteItemID,
      }),
    )

    for (const to of adminRecipients) {
      await req.payload.sendEmail({
        to,
        subject: `Gcode #${doc.id} failed to slice`,
        html,
      })

      logSentEmail({
        emailType: 'admin-gcode-slicing-failed',
        gcodeID: doc.id,
        logger: req.payload.logger,
        quoteID,
        to,
        url: adminURL,
      })
    }
  } catch (err) {
    req.payload.logger.error({
      err,
      gcodeID: doc.id,
      msg: 'Failed to send gcode slicing failed admin email',
      quoteID,
      quoteItemID,
    })
  }

  return doc
}
