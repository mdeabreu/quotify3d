import type { PayloadRequest } from 'payload'

import type { Gcode, Quote, QuoteStatus } from '@/payload-types'
import { resolveRelationID } from '@/utilities/resolveRelationID'

type QuoteItem = Quote['items'][number]
type ManagedQuoteStatus = Extract<QuoteStatus, 'new' | 'queued' | 'sliced'>
type RecomputeOptions = {
  quote: Quote
  reconcileOwnedGcodes: boolean
  req: PayloadRequest
}

const IN_PROGRESS_GCODE_STATUSES = new Set<Gcode['status']>([
  'queued',
  'collecting-context',
  'slicing',
  'parsing',
])

const clearSlicingResults = {
  plates: [],
  estimatedWeight: null,
  estimatedDuration: null,
  estimatedPrice: null,
  slicingCommand: null,
  slicerOutput: null,
  error: null,
}

const getQuoteItems = (quote: Quote): QuoteItem[] => (Array.isArray(quote.items) ? quote.items : [])

const getQuoteItemID = (item: QuoteItem): string | null =>
  typeof item.id === 'string' && item.id.length > 0 ? item.id : null

const toNumericRelationID = (value: unknown): number | null => {
  const relationID = resolveRelationID(value)
  return typeof relationID === 'number' ? relationID : null
}

const getManagedQuoteStatus = (status: QuoteStatus): ManagedQuoteStatus | null => {
  if (status === 'new' || status === 'queued' || status === 'sliced') {
    return status
  }

  return null
}

const getItemConfiguration = (item: QuoteItem) => ({
  model: toNumericRelationID(item.model),
  filament: toNumericRelationID(item.filament),
  process: toNumericRelationID(item.process),
  machine: toNumericRelationID(item.machine),
})

const configurationsMatch = (
  left: ReturnType<typeof getItemConfiguration>,
  right: ReturnType<typeof getItemConfiguration>,
) =>
  left.model === right.model &&
  left.filament === right.filament &&
  left.process === right.process &&
  left.machine === right.machine

const getDesiredGcodeStatus = ({
  configurationChanged,
  currentStatus,
  quoteStatus,
}: {
  configurationChanged: boolean
  currentStatus: Gcode['status']
  quoteStatus: ManagedQuoteStatus | null
}): Gcode['status'] => {
  if (configurationChanged) {
    return quoteStatus === 'queued' ? 'queued' : 'new'
  }

  if (quoteStatus !== 'queued') {
    return currentStatus
  }

  if (currentStatus === 'sliced' || IN_PROGRESS_GCODE_STATUSES.has(currentStatus)) {
    return currentStatus
  }

  return 'queued'
}

const getUnitPrice = (gcode: Gcode): number | null => {
  if (typeof gcode.priceOverride === 'number') {
    return gcode.priceOverride
  }

  if (typeof gcode.estimatedPrice === 'number') {
    return gcode.estimatedPrice
  }

  return null
}

const deriveQuoteSubtotal = ({
  gcodeByItemID,
  items,
}: {
  gcodeByItemID: Map<string, Gcode>
  items: QuoteItem[]
}) =>
  items.reduce((subtotal, item) => {
    const quoteItemID = getQuoteItemID(item)
    if (!quoteItemID) return subtotal

    const gcode = gcodeByItemID.get(quoteItemID)
    if (!gcode) return subtotal

    const unitPrice = getUnitPrice(gcode)
    if (typeof unitPrice !== 'number') return subtotal

    const quantity = typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1
    return subtotal + unitPrice * quantity
  }, 0)

const deriveQuoteStatus = ({
  gcodeByItemID,
  itemIDs,
  currentStatus,
}: {
  currentStatus: QuoteStatus
  gcodeByItemID: Map<string, Gcode>
  itemIDs: string[]
}): QuoteStatus => {
  if (currentStatus === 'new') {
    return currentStatus
  }

  if (currentStatus !== 'queued' && currentStatus !== 'sliced') {
    return currentStatus
  }

  const ownedGcodes = itemIDs
    .map((quoteItemID) => gcodeByItemID.get(quoteItemID))
    .filter((gcode): gcode is Gcode => Boolean(gcode))

  const allSliced =
    ownedGcodes.length === itemIDs.length && ownedGcodes.every((gcode) => gcode.status === 'sliced')

  return allSliced ? 'sliced' : 'queued'
}

const findOwnedGcodes = async ({
  quoteID,
  req,
}: {
  quoteID: number
  req: PayloadRequest
}) =>
  req.payload.find({
    collection: 'gcodes',
    depth: 0,
    pagination: false,
    req,
    overrideAccess: true,
    where: {
      quote: {
        equals: quoteID,
      },
    },
  })

const buildOwnedGcodeMap = (gcodes: Gcode[]) =>
  new Map<string, Gcode>(gcodes.map((gcode) => [String(gcode.quoteItemID), gcode] as const))

const reconcileOwnedGcodesForQuote = async ({
  existingGcodes,
  quote,
  req,
}: {
  existingGcodes: Gcode[]
  quote: Quote
  req: PayloadRequest
}) => {
  const items = getQuoteItems(quote)
  const itemIDs = items.map(getQuoteItemID).filter((itemID): itemID is string => Boolean(itemID))
  const managedQuoteStatus = getManagedQuoteStatus(quote.status)

  const gcodeByItemID = buildOwnedGcodeMap(existingGcodes)
  const nextItems = [...items]
  let itemsChanged = false

  for (const gcode of existingGcodes) {
    if (itemIDs.includes(gcode.quoteItemID)) continue

    await req.payload.delete({
      collection: 'gcodes',
      id: gcode.id,
      req,
      overrideAccess: true,
    })

    gcodeByItemID.delete(gcode.quoteItemID)
  }

  for (const [index, item] of items.entries()) {
    const quoteItemID = getQuoteItemID(item)
    if (!quoteItemID) continue

    const configuration = getItemConfiguration(item)
    const { model, filament, process, machine } = configuration

    if (!model || !filament || !process || !machine) {
      continue
    }

    const existing = gcodeByItemID.get(quoteItemID)

    if (!existing) {
      const created = await req.payload.create({
        collection: 'gcodes',
        depth: 0,
        req,
        overrideAccess: true,
        context: {
          skipQuoteRefresh: true,
        },
        data: {
          quote: quote.id,
          quoteItemID,
          status: managedQuoteStatus === 'queued' ? 'queued' : 'new',
          model,
          filament,
          process,
          machine,
          ...clearSlicingResults,
        },
      })

      gcodeByItemID.set(quoteItemID, created)

      if (toNumericRelationID(item.gcode) !== created.id) {
        nextItems[index] = {
          ...item,
          gcode: created.id,
        }
        itemsChanged = true
      }

      continue
    }

    const existingConfiguration = {
      model: toNumericRelationID(existing.model),
      filament: toNumericRelationID(existing.filament),
      process: toNumericRelationID(existing.process),
      machine: toNumericRelationID(existing.machine),
    }

    const configurationChanged = !configurationsMatch(configuration, existingConfiguration)
    const desiredStatus = getDesiredGcodeStatus({
      configurationChanged,
      currentStatus: existing.status,
      quoteStatus: managedQuoteStatus,
    })

    const shouldUpdateGcode =
      configurationChanged ||
      desiredStatus !== existing.status ||
      toNumericRelationID(existing.quote) !== quote.id ||
      existing.quoteItemID !== quoteItemID

    let resolvedGcode = existing

    if (shouldUpdateGcode) {
      resolvedGcode = await req.payload.update({
        collection: 'gcodes',
        id: existing.id,
        depth: 0,
        req,
        overrideAccess: true,
        context: {
          skipQuoteRefresh: true,
        },
        data: {
          quote: quote.id,
          quoteItemID,
          status: desiredStatus,
          model,
          filament,
          process,
          machine,
          ...(configurationChanged ? clearSlicingResults : {}),
        },
      })

      gcodeByItemID.set(quoteItemID, resolvedGcode)
    }

    if (toNumericRelationID(item.gcode) !== resolvedGcode.id) {
      nextItems[index] = {
        ...item,
        gcode: resolvedGcode.id,
      }
      itemsChanged = true
    }
  }

  return {
    gcodeByItemID,
    itemsChanged,
    nextItems,
  }
}

export const recomputeQuoteFromOwnedGcodes = async ({
  quote,
  reconcileOwnedGcodes,
  req,
}: RecomputeOptions) => {
  const items = getQuoteItems(quote)
  if (items.length === 0) {
    return false
  }

  const itemIDs = items.map(getQuoteItemID).filter((itemID): itemID is string => Boolean(itemID))
  if (itemIDs.length !== items.length) {
    return false
  }

  const existingGcodesResult = await findOwnedGcodes({
    quoteID: quote.id,
    req,
  })

  const existingGcodes = existingGcodesResult.docs as Gcode[]

  const reconciled = reconcileOwnedGcodes
    ? await reconcileOwnedGcodesForQuote({
        existingGcodes,
        quote,
        req,
      })
    : {
        gcodeByItemID: buildOwnedGcodeMap(existingGcodes),
        itemsChanged: false,
        nextItems: items,
      }

  const nextSubtotal = deriveQuoteSubtotal({
    gcodeByItemID: reconciled.gcodeByItemID,
    items: reconciled.nextItems,
  })

  const nextStatus = deriveQuoteStatus({
    currentStatus: quote.status,
    gcodeByItemID: reconciled.gcodeByItemID,
    itemIDs,
  })

  const hasChanges =
    reconciled.itemsChanged || nextSubtotal !== (quote.subtotal ?? 0) || nextStatus !== quote.status

  if (!hasChanges) {
    return false
  }

  await req.payload.update({
    collection: 'quotes',
    id: quote.id,
    req,
    overrideAccess: true,
    context: {
      skipOwnedGcodeSync: true,
    },
    data: {
      ...(reconciled.itemsChanged ? { items: reconciled.nextItems as Quote['items'] } : {}),
      ...(nextSubtotal !== (quote.subtotal ?? 0) ? { subtotal: nextSubtotal } : {}),
      ...(nextStatus !== quote.status ? { status: nextStatus } : {}),
    },
  })

  return true
}
