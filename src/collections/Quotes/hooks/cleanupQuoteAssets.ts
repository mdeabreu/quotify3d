import type { CollectionAfterDeleteHook, CollectionBeforeDeleteHook } from 'payload'

import { deleteModelIfUnreferenced } from '@/lib/quotes/modelUploads'
import type { Quote } from '@/payload-types'
import { resolveRelationID } from '@/utilities/resolveRelationID'

const getModelIDs = (quote: Quote) =>
  [
    ...new Set(
      quote.items.flatMap((item) => {
        const modelID = resolveRelationID(item.model)
        return typeof modelID === 'number' ? [modelID] : []
      }),
    ),
  ]

export const deleteQuoteGcodes: CollectionBeforeDeleteHook = async ({ id, req }) => {
  try {
    const gcodes = await req.payload.find({
      collection: 'gcodes',
      depth: 0,
      pagination: false,
      req,
      overrideAccess: true,
      where: { quote: { equals: id } },
    })

    await Promise.all(
      gcodes.docs.map(async (gcode) => {
        try {
          await req.payload.delete({
            collection: 'gcodes',
            id: gcode.id,
            req,
            overrideAccess: true,
          })
        } catch (error) {
          req.payload.logger.warn(
            { err: error, gcodeID: gcode.id, quoteID: id },
            'Could not clean up cached G-code',
          )
        }
      }),
    )
  } catch (error) {
    req.payload.logger.warn(
      { err: error, quoteID: id },
      'Could not find cached G-code during quote cleanup',
    )
  }
}

export const deleteQuoteModels: CollectionAfterDeleteHook = async ({ doc, req }) => {
  await Promise.all(
    getModelIDs(doc as Quote).map((modelID) =>
      deleteModelIfUnreferenced({ modelID, payload: req.payload }),
    ),
  )
}
