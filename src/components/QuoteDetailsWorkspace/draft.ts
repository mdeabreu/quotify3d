import type { AvailableOption } from '@/lib/spoolAvailability'

import type { QuoteWorkspaceItem, QuoteWorkspaceSlot } from './types'

export type ItemDraft = {
  filamentId: string
  filamentLabel: string
  modelNote: string
  processId: string
  processLabel: string
  quantity: number
  sameColour: boolean
  slots: QuoteWorkspaceSlot[]
}

export type DraftAction =
  | { item: QuoteWorkspaceItem; type: 'reset' }
  | { option: AvailableOption; type: 'select-material' }
  | { option: AvailableOption; type: 'select-process' }
  | { option: AvailableOption; slotIndex: number; type: 'select-colour' }
  | { description: string; slotIndex: number; type: 'set-slot-description' }
  | { notes: string; type: 'set-model-note' }
  | { quantity: number; type: 'set-quantity' }
  | { sameColour: boolean; type: 'set-same-colour' }

export const EMPTY_SLOT: QuoteWorkspaceSlot = {
  colourId: '',
  colourLabel: '',
  description: '',
  hex: '#808080',
}

const normalizeSlots = (item: QuoteWorkspaceItem) =>
  Array.from({ length: item.modelSlotCount }, (_, index) => ({
    ...EMPTY_SLOT,
    ...item.filamentSlots[index],
  }))

export const usesSameColour = (
  item: Pick<QuoteWorkspaceItem, 'filamentSlots' | 'modelSlotCount'>,
) =>
  item.filamentSlots.length === item.modelSlotCount &&
  Boolean(item.filamentSlots[0]?.colourId) &&
  item.filamentSlots.every((slot) => slot.colourId === item.filamentSlots[0]?.colourId)

export const createDraft = (item: QuoteWorkspaceItem): ItemDraft => ({
  filamentId: item.filamentId,
  filamentLabel: item.filamentLabel,
  modelNote: item.modelNote,
  processId: item.processId,
  processLabel: item.processLabel,
  quantity: item.quantity,
  sameColour: item.modelSlotCount === 1 || usesSameColour(item),
  slots: normalizeSlots(item),
})

export const normalizeDraftForApply = (draft: ItemDraft): ItemDraft => {
  const assignedColours = draft.slots.map((slot) => slot.colourId).filter(Boolean)
  const sameColour =
    draft.sameColour ||
    (assignedColours.length === draft.slots.length &&
      assignedColours.every((colour) => colour === assignedColours[0]))

  return {
    ...draft,
    sameColour,
    slots: sameColour ? draft.slots.map((slot) => ({ ...slot, description: '' })) : draft.slots,
  }
}

export const serializeDraft = (draft: ItemDraft) =>
  JSON.stringify({
    filamentId: draft.filamentId,
    modelNote: draft.modelNote,
    processId: draft.processId,
    quantity: draft.quantity,
    sameColour: draft.sameColour,
    slots: draft.slots.map((slot) => ({
      colourId: slot.colourId,
      description: draft.sameColour ? '' : slot.description,
    })),
  })

export const serializeSlicingDraft = (draft: ItemDraft) =>
  JSON.stringify({
    filamentId: draft.filamentId,
    processId: draft.processId,
    slots: draft.slots.map((slot) => slot.colourId),
  })

export const itemDraftReducer = (draft: ItemDraft, action: DraftAction): ItemDraft => {
  switch (action.type) {
    case 'reset':
      return createDraft(action.item)
    case 'select-material':
      if (draft.filamentId === String(action.option.id)) return draft
      return {
        ...draft,
        filamentId: String(action.option.id),
        filamentLabel: action.option.name,
        slots: draft.slots.map(() => ({ ...EMPTY_SLOT })),
      }
    case 'select-process':
      return {
        ...draft,
        processId: String(action.option.id),
        processLabel: action.option.name,
      }
    case 'select-colour': {
      const updateSlot = (slot: QuoteWorkspaceSlot): QuoteWorkspaceSlot => ({
        ...slot,
        colourId: String(action.option.id),
        colourLabel: action.option.name,
        hex: 'swatches' in action.option ? action.option.swatches[0] || '#808080' : '#808080',
      })
      return {
        ...draft,
        slots: draft.sameColour
          ? draft.slots.map((slot) => ({ ...updateSlot(slot), description: '' }))
          : draft.slots.map((slot, index) =>
              index === action.slotIndex ? updateSlot(slot) : slot,
            ),
      }
    }
    case 'set-slot-description':
      return {
        ...draft,
        slots: draft.slots.map((slot, index) =>
          index === action.slotIndex ? { ...slot, description: action.description } : slot,
        ),
      }
    case 'set-model-note':
      return { ...draft, modelNote: action.notes }
    case 'set-quantity':
      return { ...draft, quantity: Math.max(1, action.quantity) }
    case 'set-same-colour': {
      if (!action.sameColour) return { ...draft, sameColour: false }
      const selected = draft.slots.find((slot) => slot.colourId) ?? EMPTY_SLOT
      return {
        ...draft,
        sameColour: true,
        slots: draft.slots.map(() => ({ ...selected, description: '' })),
      }
    }
  }
}

export const draftToFormSlots = (draft: ItemDraft) =>
  draft.slots.map((slot) => ({
    colour: slot.colourId,
    description: draft.sameColour ? '' : slot.description,
  }))
