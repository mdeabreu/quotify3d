import { describe, expect, it } from 'vitest'

import {
  createDraft,
  draftToFormSlots,
  itemDraftReducer,
  normalizeDraftForApply,
} from '@/components/QuoteDetailsWorkspace/draft'
import type { QuoteWorkspaceItem } from '@/components/QuoteDetailsWorkspace/types'

const item: QuoteWorkspaceItem = {
  configurationIssues: [],
  configured: false,
  filamentId: '1',
  filamentLabel: 'PLA',
  filamentSlots: [
    { colourId: '10', colourLabel: 'Red', description: 'Body', hex: '#ff0000' },
    { colourId: '11', colourLabel: 'Black', description: 'Eyes', hex: '#111111' },
  ],
  gcodeDuration: null,
  gcodePrice: null,
  gcodeStatus: null,
  gcodeWeight: null,
  id: 'line-one',
  modelLabel: 'model.3mf',
  modelNote: '',
  modelSlotCount: 2,
  modelURL: '/model',
  processId: '20',
  processLabel: 'Standard',
  quantity: 1,
}

describe('quote workspace draft reducer', () => {
  it('clears every colour when material changes', () => {
    const next = itemDraftReducer(createDraft(item), {
      option: {
        description: null,
        id: 2,
        imageUrl: null,
        kind: 'filament',
        name: 'PETG',
        pricePerGram: null,
      },
      type: 'select-material',
    })

    expect(next.filamentId).toBe('2')
    expect(next.slots.every((slot) => !slot.colourId && !slot.description)).toBe(true)
  })

  it('fills all slots and clears descriptions in same-colour mode', () => {
    const sameColour = itemDraftReducer(createDraft(item), {
      sameColour: true,
      type: 'set-same-colour',
    })
    const applied = normalizeDraftForApply(sameColour)

    expect(draftToFormSlots(applied)).toEqual([
      { colour: '10', description: '' },
      { colour: '10', description: '' },
    ])
  })

  it('updates one ordered slot in by-slot mode', () => {
    const next = itemDraftReducer(createDraft(item), {
      option: {
        description: null,
        finish: null,
        id: 12,
        imageUrl: null,
        kind: 'colour',
        name: 'Tan',
        swatches: ['#d2b48c'],
        type: null,
      },
      slotIndex: 1,
      type: 'select-colour',
    })

    expect(next.slots.map((slot) => slot.colourId)).toEqual(['10', '12'])
  })
})
