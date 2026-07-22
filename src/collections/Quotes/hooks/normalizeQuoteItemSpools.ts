import type { CollectionBeforeValidateHook } from 'payload'

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

export const normalizeQuoteItemSpools: CollectionBeforeValidateHook = async ({ data, req }) => {
  if (!data || !Array.isArray(data.items)) {
    return data
  }

  const items = await Promise.all(
    data.items.map(async (item) => {
      if (!item || typeof item !== 'object') return item
      const typedItem = item as QuoteItemInput

      const slotCount = await getModelFilamentSlotCount({
        item: typedItem,
        req,
      })
      const slots = normalizeFilamentSlots({
        colourID: toNumericRelationID(typedItem.colour),
        item: typedItem,
        slotCount,
      })
      const filamentID = toNumericRelationID(typedItem.filament)
      const firstColourID = toNumericRelationID(slots[0]?.colour)
      const spool =
        filamentID && firstColourID
          ? await getActiveSpoolForPair({ colourID: firstColourID, filamentID, req })
          : null

      return {
        ...item,
        colour: firstColourID,
        spool: spool?.id ?? null,
        filamentSlots: slots,
      }
    }),
  )

  return {
    ...data,
    items,
  }
}
