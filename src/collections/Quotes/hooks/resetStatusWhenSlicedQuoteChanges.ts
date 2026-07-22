import type { CollectionBeforeChangeHook } from 'payload'

import { getSlicingSelectionKey, type QuoteItem } from '@/lib/quotes/quoteItemConfiguration'

const hasOwn = (value: unknown, key: string): boolean =>
  Boolean(value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, key))

const serializeItems = (items: unknown): string => {
  if (!Array.isArray(items)) return '[]'
  return JSON.stringify(items.map((item) => getSlicingSelectionKey(item as QuoteItem)))
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

  const itemsChanged =
    hasOwn(data, 'items') && serializeItems(data.items) !== serializeItems(originalDoc.items)

  if (!itemsChanged) {
    return data
  }

  data.status = 'new'
  return data
}
