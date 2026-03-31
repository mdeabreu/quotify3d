import type { CollectionAfterChangeHook } from 'payload'

import { getServerSideURL } from '@/utilities/getURL'
import { resolveRelationID } from '@/utilities/resolveRelationID'

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

export const sendQuoteApprovedEmail: CollectionAfterChangeHook = async ({
  doc,
  operation,
  previousDoc,
  req,
}) => {
  if (!doc) return doc

  const movedToApproved =
    doc.status === 'approved' && (operation === 'create' || previousDoc?.status !== 'approved')

  if (!movedToApproved) {
    return doc
  }

  try {
    const customerEmail = toOptionalString(doc.customerEmail)

    if (customerEmail) {
      const quoteURL = getQuoteURL({
        accessToken: toOptionalString(doc.accessToken),
        customerEmail,
        quoteID: doc.id,
        recipientSource: 'guest',
      })

      await req.payload.sendEmail({
        to: customerEmail,
        subject: `Your quote #${doc.id} is approved`,
        html: `
          <h1>Your quote is approved</h1>
          <p>Your quote #${doc.id} has been approved and is ready for you to review.</p>
          <p>You can now return to your quote, add the approved items to your cart, and complete checkout.</p>
          <p><a href="${quoteURL}">View quote #${doc.id}</a></p>
          <p>If the button above does not work, copy and paste this link into your browser:</p>
          <p>${quoteURL}</p>
        `,
      })

      return doc
    }

    const customerID = resolveRelationID(doc.customer)

    if (!customerID) {
      req.payload.logger.warn({
        msg: 'Skipping quote approved email because no customer email could be resolved',
        quoteID: doc.id,
      })
      return doc
    }

    const customer = await req.payload.findByID({
      collection: 'users',
      id: customerID,
      depth: 0,
      overrideAccess: true,
      req,
      select: {
        email: true,
      },
    })

    const recipientEmail = toOptionalString(customer.email)

    if (!recipientEmail) {
      req.payload.logger.warn({
        customerID,
        msg: 'Skipping quote approved email because customer has no email address',
        quoteID: doc.id,
      })
      return doc
    }

    const quoteURL = getQuoteURL({
      quoteID: doc.id,
      recipientSource: 'customer',
    })

    await req.payload.sendEmail({
      to: recipientEmail,
      subject: `Your quote #${doc.id} is approved`,
      html: `
        <h1>Your quote is approved</h1>
        <p>Your quote #${doc.id} has been approved and is ready for you to review.</p>
        <p>You can now return to your quote, add the approved items to your cart, and complete checkout.</p>
        <p><a href="${quoteURL}">View quote #${doc.id}</a></p>
        <p>If the button above does not work, copy and paste this link into your browser:</p>
        <p>${quoteURL}</p>
      `,
    })
  } catch (err) {
    req.payload.logger.error({
      err,
      msg: 'Failed to send quote approved email',
      quoteID: doc.id,
    })
  }

  return doc
}
