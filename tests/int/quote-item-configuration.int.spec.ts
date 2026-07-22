import type { PayloadRequest } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { analyzeQuoteItemConfiguration } from '@/lib/quotes/quoteItemConfiguration'
import type { Quote } from '@/payload-types'

const item = (overrides: Partial<Quote['items'][number]> = {}) =>
  ({
    filament: 1,
    filamentSlots: [{ colour: 10 }, { colour: 11 }, { colour: 12 }],
    machine: 3,
    model: 4,
    process: 2,
    quantity: 1,
    ...overrides,
  }) as Quote['items'][number]

const request = ({
  active = {},
  availableColours = [10, 11, 12],
  slotCount = 3,
}: {
  active?: Partial<Record<'filaments' | 'machines' | 'processes', boolean>>
  availableColours?: number[]
  slotCount?: number
} = {}) =>
  ({
    payload: {
      findByID: vi.fn(async ({ collection }: { collection: string }) =>
        collection === 'models'
          ? { filamentSlotCount: slotCount }
          : { active: active[collection as keyof typeof active] ?? true },
      ),
      find: vi.fn(async () => ({
        docs: availableColours.map((id, index) => ({
          active: true,
          colour: { active: true, id },
          id: index + 1,
          material: { active: true, id: 1 },
        })),
      })),
    },
  }) as unknown as PayloadRequest

const context = (options?: Parameters<typeof request>[0]) => {
  const req = request(options)
  return { payload: req.payload, req }
}

describe('analyzeQuoteItemConfiguration', () => {
  it('returns an ordered canonical configuration for a complete item', async () => {
    const result = await analyzeQuoteItemConfiguration({ item: item(), ...context() })

    expect(result).toMatchObject({
      complete: true,
      configuration: {
        filament: 1,
        filamentSlots: [{ colour: 10 }, { colour: 11 }, { colour: 12 }],
        machine: 3,
        model: 4,
        process: 2,
      },
      issues: [],
      slotColourIDs: [10, 11, 12],
      slotCount: 3,
    })
    expect(result.configurationKey).toBe(
      JSON.stringify({
        model: 4,
        filament: 1,
        filamentSlots: [10, 11, 12],
        process: 2,
        machine: 3,
      }),
    )
  })

  it('preserves partial slot positions and reports every missing assignment', async () => {
    const result = await analyzeQuoteItemConfiguration({
      item: item({ filamentSlots: [{ colour: 10 }, {}, { colour: 12 }] }),
      ...context(),
    })

    expect(result.complete).toBe(false)
    expect(result.configuration).toBeNull()
    expect(result.slotColourIDs).toEqual([10, null, 12])
    expect(result.issues).toContainEqual({ code: 'missing-slot-colour', slotIndex: 1 })
  })

  it('keeps unavailable secondary colours saved but incomplete', async () => {
    const result = await analyzeQuoteItemConfiguration({
      item: item(),
      ...context({ availableColours: [10, 12] }),
    })

    expect(result.complete).toBe(false)
    expect(result.slotColourIDs).toEqual([10, 11, 12])
    expect(result.issues).toContainEqual({ code: 'unavailable-slot-colour', slotIndex: 1 })
  })

  it.each([
    ['filaments', 'unavailable-material'],
    ['processes', 'unavailable-process'],
    ['machines', 'unavailable-machine'],
  ] as const)('blocks inactive %s', async (collection, issue) => {
    const result = await analyzeQuoteItemConfiguration({
      item: item(),
      ...context({ active: { [collection]: false } }),
    })

    expect(result.complete).toBe(false)
    expect(result.issues).toContainEqual({ code: issue })
  })
})
