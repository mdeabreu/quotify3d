import type { CollectionAfterChangeHook } from 'payload'

import { recomputeQuoteFromOwnedGcodes } from '@/collections/Quotes/hooks/recomputeQuoteFromOwnedGcodes'
import type { Quote } from '@/payload-types'
import { resolveRelationID } from '@/utilities/resolveRelationID'

const TERMINAL_GCODE_STATUSES = new Set(['sliced', 'failed'])

const hasRelevantChanges = ({
  doc,
  operation,
  previousDoc,
}: {
  doc: NonNullable<Parameters<CollectionAfterChangeHook>[0]['doc']>
  operation: Parameters<CollectionAfterChangeHook>[0]['operation']
  previousDoc: Parameters<CollectionAfterChangeHook>[0]['previousDoc']
}) => {
  const statusChanged = previousDoc?.status !== doc.status
  const movedToTerminalStatus = statusChanged && TERMINAL_GCODE_STATUSES.has(doc.status)

  return (
    operation === 'create' ||
    movedToTerminalStatus ||
    previousDoc?.estimatedPrice !== doc.estimatedPrice ||
  previousDoc?.priceOverride !== doc.priceOverride ||
  resolveRelationID(previousDoc?.quote) !== resolveRelationID(doc.quote) ||
    previousDoc?.quoteItemID !== doc.quoteItemID
  )
}

export const syncOwningQuote: CollectionAfterChangeHook = async ({
  context,
  doc,
  operation,
  previousDoc,
  req,
}) => {
  if (!doc || context?.skipQuoteRefresh) {
    return doc
  }

  const quoteID = resolveRelationID(doc.quote)
  if (!quoteID || !hasRelevantChanges({ doc, operation, previousDoc })) {
    return doc
  }

  const quote = await req.payload.findByID({
    collection: 'quotes',
    id: quoteID,
    depth: 0,
    req,
    overrideAccess: true,
  })

  await recomputeQuoteFromOwnedGcodes({
    quote: quote as Quote,
    reconcileOwnedGcodes: false,
    req,
  })

  return doc
}
