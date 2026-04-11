import type { CollectionBeforeChangeHook } from 'payload'

import { resolveRelationID } from '@/utilities/resolveRelationID'

const hasOwn = (value: unknown, key: string): boolean =>
  Boolean(value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, key))

const serializeItems = (items: unknown): string => {
  if (!Array.isArray(items)) return '[]'

  return JSON.stringify(
    items.map((item) => ({
      model: resolveRelationID(item?.model) ?? null,
      filament: resolveRelationID(item?.filament) ?? null,
      colour: resolveRelationID(item?.colour) ?? null,
      process: resolveRelationID(item?.process) ?? null,
      machine: resolveRelationID(item?.machine) ?? null,
      quantity: typeof item?.quantity === 'number' ? item.quantity : null,
    })),
  )
}

export const resetStatusWhenSlicedQuoteChanges: CollectionBeforeChangeHook = async ({
  data,
  operation,
  originalDoc,
}) => {
  if (operation !== 'update' || !originalDoc || !data) {
    return data
  }

  if (originalDoc.status !== 'sliced') {
    return data
  }

  if (hasOwn(data, 'status') && data.status !== 'sliced') {
    return data
  }

  const notesChanged =
    hasOwn(data, 'notes') && (typeof data.notes === 'string' ? data.notes : null) !== originalDoc.notes
  const itemsChanged =
    hasOwn(data, 'items') && serializeItems(data.items) !== serializeItems(originalDoc.items)

  if (!notesChanged && !itemsChanged) {
    return data
  }

  data.status = 'new'
  return data
}
