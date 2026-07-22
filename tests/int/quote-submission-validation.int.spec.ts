import { describe, expect, it, vi } from 'vitest'

import { ensureQuoteReadyForReview } from '@/collections/Quotes/hooks/ensureQuoteReadyForReview'

const quoteItem = {
  filament: 1,
  filamentSlots: [{ colour: 10 }, { colour: 11 }],
  gcode: 8,
  machine: 3,
  model: 4,
  process: 2,
  quantity: 1,
}

const request = ({ gcodeMissing = false, materialActive = true, status = 'sliced' } = {}) =>
  ({
    payload: {
      find: vi.fn(async () => ({
        docs: [10, 11].map((id) => ({
          active: true,
          colour: { active: true, id },
          material: { active: true, id: 1 },
        })),
      })),
      findByID: vi.fn(async ({ collection }: { collection: string }) => {
        if (collection === 'models') return { filamentSlotCount: 2 }
        if (collection === 'filaments') return { active: materialActive }
        if (collection === 'gcodes') {
          if (gcodeMissing) throw new Error('Not found')
          return { ...quoteItem, status }
        }
        return { active: true }
      }),
    },
  }) as never

describe('quote submission validation', () => {
  it('rejects unavailable saved selections', async () => {
    await expect(
      ensureQuoteReadyForReview({
        data: { items: [quoteItem], status: 'ready-for-review' },
        operation: 'update',
        originalDoc: { status: 'sliced' },
        req: request({ materialActive: false }),
      } as never),
    ).rejects.toThrow('Incomplete line: 1')
  })

  it('accepts a matching terminal failed estimate for manual review', async () => {
    await expect(
      ensureQuoteReadyForReview({
        data: { items: [quoteItem], status: 'ready-for-review' },
        operation: 'update',
        originalDoc: { status: 'queued' },
        req: request({ status: 'failed' }),
      } as never),
    ).resolves.toMatchObject({ status: 'ready-for-review' })
  })

  it('rejects a mismatched or nonterminal estimate', async () => {
    await expect(
      ensureQuoteReadyForReview({
        data: { items: [quoteItem], status: 'ready-for-review' },
        operation: 'update',
        originalDoc: { status: 'queued' },
        req: request({ status: 'queued' }),
      } as never),
    ).rejects.toThrow('Wait for the current estimate')
  })

  it('treats a missing linked G-code as an unfinished estimate', async () => {
    await expect(
      ensureQuoteReadyForReview({
        data: { items: [quoteItem], status: 'ready-for-review' },
        operation: 'update',
        originalDoc: { status: 'queued' },
        req: request({ gcodeMissing: true }),
      } as never),
    ).rejects.toThrow('Wait for the current estimate')
  })
})
