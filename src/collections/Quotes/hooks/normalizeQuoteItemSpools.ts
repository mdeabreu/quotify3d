import type { CollectionBeforeValidateHook } from 'payload'
import { APIError } from 'payload'

import { toNumericRelationID } from '@/lib/spoolAvailability'

type QuoteItemInput = {
  colour?: unknown
  filamentSlots?: unknown
  filament?: unknown
  id?: unknown
  machine?: unknown
  model?: unknown
  notes?: unknown
  process?: unknown
  quantity?: unknown
  spool?: unknown
}

const trackedItemFields = [
  'model',
  'quantity',
  'spool',
  'filament',
  'colour',
  'filamentSlots',
  'process',
  'machine',
] as const

const serializeFilamentSlots = (slots: unknown): string => {
  if (!Array.isArray(slots)) return '[]'

  return JSON.stringify(
    slots.map((slot) => ({
      colour: toNumericRelationID(slot?.colour) ?? null,
    })),
  )
}

const itemSelectionUnchanged = ({
  item,
  originalItem,
}: {
  item: QuoteItemInput
  originalItem: QuoteItemInput | undefined
}) => {
  if (!originalItem) return false

  return trackedItemFields.every((field) => {
    if (field === 'quantity') {
      return item.quantity === originalItem.quantity
    }

    if (field === 'filamentSlots') {
      return (
        serializeFilamentSlots(item.filamentSlots) ===
        serializeFilamentSlots(originalItem.filamentSlots)
      )
    }

    return toNumericRelationID(item[field]) === toNumericRelationID(originalItem[field])
  })
}

const getActiveSpoolForPair = async ({
  colourID,
  filamentID,
  req,
}: {
  colourID: number
  filamentID: number
  req: Parameters<CollectionBeforeValidateHook>[0]['req']
}) => {
  const result = await req.payload.find({
    collection: 'spools',
    depth: 1,
    limit: 100,
    pagination: false,
    req,
    overrideAccess: true,
    sort: 'id',
    where: {
      and: [
        {
          active: {
            equals: true,
          },
        },
        {
          material: {
            equals: filamentID,
          },
        },
        {
          colour: {
            equals: colourID,
          },
        },
      ],
    },
  })

  return result.docs.find((spool) => {
    const material = spool.material
    const colour = spool.colour

    return (
      typeof material === 'object' &&
      Boolean(material.active) &&
      typeof colour === 'object' &&
      Boolean(colour.active)
    )
  })
}

const resolveActiveSpool = async ({
  item,
  req,
}: {
  item: QuoteItemInput
  req: Parameters<CollectionBeforeValidateHook>[0]['req']
}) => {
  const spoolID = toNumericRelationID(item.spool)
  const filamentID = toNumericRelationID(item.filament)
  const colourID = toNumericRelationID(item.colour)

  if (spoolID) {
    const spool = await req.payload.findByID({
      collection: 'spools',
      id: spoolID,
      depth: 1,
      req,
      overrideAccess: true,
    })

    const spoolFilamentID = toNumericRelationID(spool.material)
    const spoolColourID = toNumericRelationID(spool.colour)
    const material = typeof spool.material === 'object' ? spool.material : null
    const colour = typeof spool.colour === 'object' ? spool.colour : null

    if (!spool.active || !material?.active || !colour?.active) {
      throw new APIError('Selected spool is no longer available.', 400)
    }

    if (filamentID && spoolFilamentID !== filamentID) {
      throw new APIError('Selected spool does not match the selected material.', 400)
    }

    if (colourID && spoolColourID !== colourID) {
      throw new APIError('Selected spool does not match the selected colour.', 400)
    }

    return {
      colour: spoolColourID,
      filament: spoolFilamentID,
      spool: spool.id,
    }
  }

  if (!filamentID || !colourID) {
    return null
  }

  const spool = await getActiveSpoolForPair({
    colourID,
    filamentID,
    req,
  })

  if (!spool) {
    throw new APIError('Selected material and colour combination is not available.', 400)
  }

  return {
    colour: colourID,
    filament: filamentID,
    spool: spool.id,
  }
}

const getModelFilamentSlotCount = async ({
  item,
  req,
}: {
  item: QuoteItemInput
  req: Parameters<CollectionBeforeValidateHook>[0]['req']
}) => {
  const modelID = toNumericRelationID(item.model)
  if (!modelID) return 1

  const model = await req.payload.findByID({
    collection: 'models',
    id: modelID,
    depth: 0,
    req,
    overrideAccess: true,
  })

  return typeof model.filamentSlotCount === 'number' && model.filamentSlotCount > 0
    ? Math.floor(model.filamentSlotCount)
    : 1
}

const normalizeFilamentSlots = ({
  colourID,
  item,
  slotCount,
}: {
  colourID: number | null
  item: QuoteItemInput
  slotCount: number
}) => {
  const slots = Array.isArray(item.filamentSlots) ? item.filamentSlots : []
  const fallbackColourID = slots.length === 0 ? colourID : null
  const normalized = slots.slice(0, slotCount).map((slot) => ({
    colour: toNumericRelationID(slot?.colour) ?? fallbackColourID ?? undefined,
    description:
      typeof slot?.description === 'string' && slot.description.trim()
        ? slot.description.trim()
        : undefined,
  }))

  while (normalized.length < slotCount) {
    normalized.push({ colour: fallbackColourID ?? undefined, description: undefined })
  }

  return normalized
}

export const normalizeQuoteItemSpools: CollectionBeforeValidateHook = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  if (!data || !Array.isArray(data.items)) {
    return data
  }

  const originalItemsByID = new Map<string, QuoteItemInput>()
  if (operation === 'update' && Array.isArray(originalDoc?.items)) {
    for (const originalItem of originalDoc.items) {
      if (typeof originalItem?.id === 'string') {
        originalItemsByID.set(originalItem.id, originalItem as QuoteItemInput)
      }
    }
  }

  const items = await Promise.all(
    data.items.map(async (item) => {
      if (!item || typeof item !== 'object') return item
      const typedItem = item as QuoteItemInput

      const originalItem =
        operation === 'update' && typeof typedItem.id === 'string'
          ? originalItemsByID.get(typedItem.id)
          : undefined
      const slotCount = await getModelFilamentSlotCount({
        item: typedItem,
        req,
      })
      const selectionUnchanged =
        operation === 'update' &&
        typeof typedItem.id === 'string' &&
        itemSelectionUnchanged({
          item: typedItem,
          originalItem,
        })
      const colourChanged =
        originalItem &&
        toNumericRelationID(typedItem.colour) !== toNumericRelationID(originalItem.colour)
      const slotsWereCarriedForward =
        originalItem &&
        serializeFilamentSlots(typedItem.filamentSlots) ===
          serializeFilamentSlots(originalItem.filamentSlots)
      const itemForSlots =
        colourChanged && slotsWereCarriedForward
          ? {
              ...typedItem,
              filamentSlots: undefined,
            }
          : typedItem
      const slots = normalizeFilamentSlots({
        colourID: toNumericRelationID(typedItem.colour),
        item: itemForSlots,
        slotCount,
      })

      if (
        selectionUnchanged &&
        slots.length === slotCount &&
        serializeFilamentSlots(slots) === serializeFilamentSlots(typedItem.filamentSlots)
      ) {
        return item
      }

      const resolved = await resolveActiveSpool({
        item: typedItem,
        req,
      })

      if (!resolved) {
        return {
          ...item,
          filamentSlots: slots,
        }
      }

      return {
        ...item,
        ...resolved,
        filamentSlots: slots,
      }
    }),
  )

  return {
    ...data,
    items,
  }
}
