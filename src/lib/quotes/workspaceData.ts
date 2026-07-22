import type { Quote, QuoteStatus } from '@/payload-types'
import { resolveRelationID } from '@/utilities/resolveRelationID'

const EDITABLE_STATUSES = new Set<QuoteStatus>(['new', 'queued', 'sliced'])

const numericRelationID = (value: unknown): number | null => {
  const id = resolveRelationID(value)
  return typeof id === 'number' ? id : null
}

export const isEditableQuoteStatus = (status: QuoteStatus) => EDITABLE_STATUSES.has(status)

export const serializeQuoteItem = (item: Quote['items'][number]) => {
  const model = numericRelationID(item.model)
  if (!model) return null

  const optionalRelation = (value: unknown) => numericRelationID(value) ?? undefined
  return {
    id: item.id ?? undefined,
    model,
    quantity: item.quantity,
    spool: optionalRelation(item.spool),
    filament: optionalRelation(item.filament),
    colour: optionalRelation(item.colour),
    filamentSlots: Array.isArray(item.filamentSlots)
      ? item.filamentSlots.map((slot) => ({
          colour: optionalRelation(slot?.colour),
          description:
            typeof slot.description === 'string' && slot.description.trim()
              ? slot.description.trim()
              : undefined,
        }))
      : undefined,
    notes: typeof item.notes === 'string' && item.notes.trim() ? item.notes.trim() : undefined,
    process: optionalRelation(item.process),
    machine: optionalRelation(item.machine),
    gcode: optionalRelation(item.gcode),
  }
}

export const getQuotePath = (
  quoteID: number,
  customerEmail: string,
  accessToken: string,
  selectedItemID?: string,
) => {
  const params = new URLSearchParams()
  if (customerEmail) params.set('email', customerEmail)
  if (accessToken) params.set('accessToken', accessToken)
  if (selectedItemID) params.set('item', selectedItemID)
  return `/quotes/${quoteID}${params.size ? `?${params.toString()}` : ''}`
}
