import type { CollectionAfterChangeHook } from 'payload'

import { recomputeQuoteFromOwnedGcodes } from '@/collections/Quotes/hooks/recomputeQuoteFromOwnedGcodes'

export const syncOwnedGcodesForQuote: CollectionAfterChangeHook = async ({
  context,
  doc,
  req,
}) => {
  if (!doc || context?.skipOwnedGcodeSync) {
    return doc
  }

  await recomputeQuoteFromOwnedGcodes({
    quote: doc,
    reconcileOwnedGcodes: true,
    req,
  })

  return doc
}
