import type { CollectionAfterChangeHook } from 'payload'

import { resolveRelationID } from '@/utilities/resolveRelationID'

const syncableQuoteStatuses = new Set(['in-review', 'approved'])

export const syncGcodeStatusesFromQuote: CollectionAfterChangeHook = async ({
  doc,
  operation,
  previousDoc,
  req,
}) => {
  if (!doc || !syncableQuoteStatuses.has(doc.status)) {
    return doc
  }

  const movedToSyncableStatus =
    operation === 'create' ||
    (operation === 'update' && previousDoc?.status !== doc.status)

  if (!movedToSyncableStatus) {
    return doc
  }

  const gcodeIds = new Set<number>()

  if (Array.isArray(doc.items)) {
    for (const item of doc.items) {
      if (!item) continue

      const gcodeID = resolveRelationID(item.gcode)
      if (typeof gcodeID === 'number') {
        gcodeIds.add(gcodeID)
      }
    }
  }

  if (gcodeIds.size === 0) {
    return doc
  }

  const gcodesToUpdate = await req.payload.find({
    collection: 'gcodes',
    depth: 0,
    limit: gcodeIds.size,
    req,
    overrideAccess: true,
    where: {
      and: [
        {
          id: {
            in: Array.from(gcodeIds),
          },
        },
        {
          status: {
            not_equals: doc.status,
          },
        },
      ],
    },
  })

  for (const gcode of gcodesToUpdate.docs) {
    await req.payload.update({
      collection: 'gcodes',
      id: gcode.id,
      req,
      overrideAccess: true,
      data: {
        status: doc.status,
      },
    })
  }

  return doc
}
