import type { CollectionBeforeChangeHook } from 'payload'

import { resolveRelationID } from '@/utilities/resolveRelationID'

export const resolveQuoteSubtotal: CollectionBeforeChangeHook = async ({ data, req }) => {
  if (!data) return data

  let subtotal = 0

  if (Array.isArray(data.items) && data.items.length > 0) {
    for (const item of data.items) {
      if (!item) continue

      const gcodeId = resolveRelationID(item.gcode)
      if (!gcodeId) continue

      try {
        const gcode = await req.payload.findByID({
          collection: 'gcodes',
          depth: 0,
          id: gcodeId,
          req,
          overrideAccess: true,
        })

        if (typeof gcode.priceOverride === 'number') {
          subtotal += gcode.priceOverride * item.quantity
        } else if (typeof gcode.estimatedPrice === 'number') {
          subtotal += gcode.estimatedPrice * item.quantity
        }
      } catch {
        continue
      }
    }
  }

  data.subtotal = subtotal
  return data
}
