import { APIError, type CollectionBeforeChangeHook } from 'payload'

import { resolveRelationID } from '@/utilities/resolveRelationID'

type PricedGcode = {
  estimatedPrice?: unknown
  priceOverride?: unknown
}

export const getApprovedPrice = (gcode: PricedGcode): number | undefined => {
  if (typeof gcode.priceOverride === 'number' && Number.isFinite(gcode.priceOverride)) {
    return gcode.priceOverride
  }

  if (typeof gcode.estimatedPrice === 'number' && Number.isFinite(gcode.estimatedPrice)) {
    return gcode.estimatedPrice
  }

  return undefined
}

export const ensurePricedItemsBeforeApproval: CollectionBeforeChangeHook = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  if (!data || data.status !== 'approved') {
    return data
  }

  if (operation === 'update' && originalDoc?.status === 'approved') {
    return data
  }

  const items = Array.isArray(data.items)
    ? data.items
    : Array.isArray(originalDoc?.items)
      ? originalDoc.items
      : []

  const unpricedLineNumbers: number[] = []

  for (const [index, item] of items.entries()) {
    const lineNumber = index + 1
    const gcodeID = resolveRelationID(item?.gcode)

    if (typeof gcodeID !== 'number') {
      unpricedLineNumbers.push(lineNumber)
      continue
    }

    const gcode = await req.payload.findByID({
      collection: 'gcodes',
      id: gcodeID,
      depth: 0,
      req,
      overrideAccess: true,
      select: {
        estimatedPrice: true,
        priceOverride: true,
      },
    })

    if (typeof getApprovedPrice(gcode) !== 'number') {
      unpricedLineNumbers.push(lineNumber)
    }
  }

  if (unpricedLineNumbers.length > 0) {
    throw new APIError(
      `Cannot approve quote until every item has a price. Missing prices for line ${unpricedLineNumbers.join(', ')}.`,
      400,
    )
  }

  return data
}
