import type { PayloadRequest } from 'payload'

import {
  analyzeQuoteItemConfiguration,
  gcodeMatchesConfiguration,
  type QuoteItem,
  type QuoteItemConfigurationAnalysis,
} from '@/lib/quotes/quoteItemConfiguration'
import type { Gcode, Quote, QuoteStatus } from '@/payload-types'
import { toMinorUnitAmount } from '@/utilities/currency'
import { resolveRelationID } from '@/utilities/resolveRelationID'

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

const TERMINAL_GCODE_STATUSES = new Set<Gcode['status']>(['sliced', 'failed'])

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

const getDesiredGcodeStatus = ({
  currentStatus,
  quoteStatus,
}: {
  currentStatus: Gcode['status']
  quoteStatus: ManagedQuoteStatus | null
}): Gcode['status'] => {
  if (quoteStatus !== 'queued') {
    return currentStatus
  }

  if (TERMINAL_GCODE_STATUSES.has(currentStatus) || IN_PROGRESS_GCODE_STATUSES.has(currentStatus)) {
    return currentStatus
  }

  return 'queued'
}

const getUnitPrice = (gcode: Gcode): number | null => {
  const priceOverride = toMinorUnitAmount(gcode.priceOverride)
  if (typeof priceOverride === 'number') {
    return priceOverride
  }

  const estimatedPrice = toMinorUnitAmount(gcode.estimatedPrice)
  if (typeof estimatedPrice === 'number') {
    return estimatedPrice
  }

  return null
}

const deriveQuoteSubtotal = ({
  analyses,
  gcodeByItemID,
  items,
}: {
  analyses: Map<string, QuoteItemConfigurationAnalysis>
  gcodeByItemID: Map<string, Gcode>
  items: QuoteItem[]
}) => {
  const subtotal = items.reduce((subtotal, item) => {
    const quoteItemID = getQuoteItemID(item)
    if (!quoteItemID) return subtotal
    const analysis = analyses.get(quoteItemID)
    if (!analysis?.complete) return subtotal

    const gcode = gcodeByItemID.get(quoteItemID)
    if (
      !gcode ||
      toNumericRelationID(item.gcode) !== gcode.id ||
      !gcodeMatchesConfiguration(gcode, analysis)
    ) {
      return subtotal
    }

    const unitPrice = getUnitPrice(gcode)
    if (typeof unitPrice !== 'number') return subtotal

    const quantity = typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1
    return subtotal + unitPrice * quantity
  }, 0)

  return toMinorUnitAmount(subtotal) ?? 0
}

const deriveQuoteStatus = ({
  analyses,
  gcodeByItemID,
  items,
  currentStatus,
}: {
  analyses: Map<string, QuoteItemConfigurationAnalysis>
  currentStatus: QuoteStatus
  gcodeByItemID: Map<string, Gcode>
  items: QuoteItem[]
}): QuoteStatus => {
  const itemIDs = items.map(getQuoteItemID).filter((itemID): itemID is string => Boolean(itemID))
  if (currentStatus === 'new') {
    return currentStatus
  }

  if (currentStatus !== 'queued' && currentStatus !== 'sliced') {
    return currentStatus
  }

  if (!itemIDs.every((itemID) => analyses.get(itemID)?.complete)) return 'new'

  const ownedGcodes = items
    .map((item) => {
      const itemID = getQuoteItemID(item)
      const gcode = itemID ? gcodeByItemID.get(itemID) : undefined
      const analysis = itemID ? analyses.get(itemID) : undefined
      return gcode &&
        analysis &&
        toNumericRelationID(item.gcode) === gcode.id &&
        gcodeMatchesConfiguration(gcode, analysis)
        ? gcode
        : undefined
    })
    .filter((gcode): gcode is Gcode => Boolean(gcode))

  const allSliced =
    ownedGcodes.length === itemIDs.length && ownedGcodes.every((gcode) => gcode.status === 'sliced')

  return allSliced ? 'sliced' : 'queued'
}

const findOwnedGcodes = async ({ quoteID, req }: { quoteID: number; req: PayloadRequest }) =>
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

const groupOwnedGcodesByItemID = (gcodes: Gcode[]) => {
  const grouped = new Map<string, Gcode[]>()

  for (const gcode of gcodes) {
    const quoteItemID = String(gcode.quoteItemID)
    grouped.set(quoteItemID, [...(grouped.get(quoteItemID) ?? []), gcode])
  }

  return grouped
}

const buildLinkedGcodeMap = ({
  gcodes,
  items,
}: {
  gcodes: Gcode[]
  items: QuoteItem[]
}) => {
  const gcodeByID = new Map(gcodes.map((gcode) => [gcode.id, gcode] as const))
  const linked = new Map<string, Gcode>()

  for (const item of items) {
    const quoteItemID = getQuoteItemID(item)
    const gcode = gcodeByID.get(toNumericRelationID(item.gcode) ?? -1)
    if (quoteItemID && gcode?.quoteItemID === quoteItemID) {
      linked.set(quoteItemID, gcode)
    }
  }

  return linked
}

const findMatchingSnapshot = ({
  analysis,
  currentGcodeID,
  snapshots,
}: {
  analysis: QuoteItemConfigurationAnalysis
  currentGcodeID: number | null
  snapshots: Gcode[]
}) => {
  const matching = snapshots.filter((gcode) => gcodeMatchesConfiguration(gcode, analysis))
  return matching.find((gcode) => gcode.id === currentGcodeID) ?? matching[0]
}

const reconcileOwnedGcodesForQuote = async ({
  analyses,
  existingGcodes,
  quote,
  req,
}: {
  analyses: Map<string, QuoteItemConfigurationAnalysis>
  existingGcodes: Gcode[]
  quote: Quote
  req: PayloadRequest
}) => {
  const items = getQuoteItems(quote)
  const itemIDs = items.map(getQuoteItemID).filter((itemID): itemID is string => Boolean(itemID))
  const managedQuoteStatus = getManagedQuoteStatus(quote.status)

  const snapshotsByItemID = groupOwnedGcodesByItemID(existingGcodes)
  const linkedGcodeByItemID = new Map<string, Gcode>()
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

    snapshotsByItemID.delete(gcode.quoteItemID)
  }

  for (const [index, item] of items.entries()) {
    const quoteItemID = getQuoteItemID(item)
    if (!quoteItemID) continue

    const analysis = analyses.get(quoteItemID)
    const configuration = analysis?.configuration
    const snapshots = snapshotsByItemID.get(quoteItemID) ?? []

    if (!configuration) {
      if (toNumericRelationID(item.gcode)) {
        nextItems[index] = { ...item, gcode: null }
        itemsChanged = true
      }
      continue
    }

    const { model, filament, filamentSlots, process, machine } = configuration

    const currentGcodeID = toNumericRelationID(item.gcode)
    let resolvedGcode = findMatchingSnapshot({
      analysis,
      currentGcodeID,
      snapshots,
    })

    if (!resolvedGcode) {
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
          filamentSlots,
          process,
          machine,
          ...clearSlicingResults,
        },
      })

      snapshotsByItemID.set(quoteItemID, [...snapshots, created])
      resolvedGcode = created
    } else {
      const desiredStatus = getDesiredGcodeStatus({
        currentStatus: resolvedGcode.status,
        quoteStatus: managedQuoteStatus,
      })

      if (desiredStatus !== resolvedGcode.status) {
        resolvedGcode = await req.payload.update({
          collection: 'gcodes',
          id: resolvedGcode.id,
          depth: 0,
          req,
          overrideAccess: true,
          context: {
            skipQuoteRefresh: true,
          },
          data: {
            status: desiredStatus,
          },
        })
      }
    }

    linkedGcodeByItemID.set(quoteItemID, resolvedGcode)

    if (currentGcodeID !== resolvedGcode.id) {
      nextItems[index] = {
        ...item,
        gcode: resolvedGcode.id,
      }
      itemsChanged = true
    }
  }

  return {
    gcodeByItemID: linkedGcodeByItemID,
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
  const analyses = new Map(
    await Promise.all(
      items.map(
        async (item) =>
          [
            getQuoteItemID(item) as string,
            await analyzeQuoteItemConfiguration({ item, payload: req.payload, req }),
          ] as const,
      ),
    ),
  )

  const reconciled = reconcileOwnedGcodes
    ? await reconcileOwnedGcodesForQuote({
        analyses,
        existingGcodes,
        quote,
        req,
      })
    : {
        gcodeByItemID: buildLinkedGcodeMap({ gcodes: existingGcodes, items }),
        itemsChanged: false,
        nextItems: items,
      }

  const nextSubtotal = deriveQuoteSubtotal({
    analyses,
    gcodeByItemID: reconciled.gcodeByItemID,
    items: reconciled.nextItems,
  })

  const nextStatus = deriveQuoteStatus({
    analyses,
    currentStatus: quote.status,
    gcodeByItemID: reconciled.gcodeByItemID,
    items: reconciled.nextItems,
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
