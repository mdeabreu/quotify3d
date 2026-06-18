import type { PayloadRequest } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { recomputeQuoteFromOwnedGcodes } from '@/collections/Quotes/hooks/recomputeQuoteFromOwnedGcodes'
import { calculateGcodePrice } from '@/jobs/workflows/helpers/gcodeHelpers'
import type { Gcode, Quote } from '@/payload-types'
import { toMinorUnitAmount } from '@/utilities/currency'

describe('quote money normalization', () => {
  it('rounds arbitrary numeric amounts to minor-unit integers', () => {
    expect(toMinorUnitAmount(1932.7000000000003)).toBe(1933)
    expect(toMinorUnitAmount(Number.NaN)).toBeUndefined()
    expect(toMinorUnitAmount('1932')).toBeUndefined()
  })

  it('rounds calculated gcode prices from fractional weight and duration math', async () => {
    const findByID = vi.fn(async ({ collection }: { collection: string }) => {
      if (collection === 'filaments') {
        return { pricePerGram: 8.3 }
      }

      if (collection === 'machines') {
        return { pricePerHour: 1234 }
      }

      return {}
    })

    const price = await calculateGcodePrice({
      req: { payload: { findByID } } as unknown as PayloadRequest,
      filamentId: 1,
      machineId: 2,
      totalEstimatedWeight: 111.11,
      totalEstimatedDuration: 789.01,
    })

    expect(price).toBe(1193)
    expect(Number.isInteger(price)).toBe(true)
  })

  it('rounds recomputed quote subtotals before saving', async () => {
    const update = vi.fn()
    const req = {
      payload: {
        find: vi.fn(async () => ({
          docs: [
            {
              id: 1,
              quoteItemID: 'line-one',
              priceOverride: 966.3500000000001,
              status: 'sliced',
            },
            {
              id: 2,
              quoteItemID: 'line-two',
              estimatedPrice: 500.4,
              status: 'sliced',
            },
          ] satisfies Partial<Gcode>[],
        })),
        update,
      },
    }

    await recomputeQuoteFromOwnedGcodes({
      quote: {
        id: 10,
        status: 'queued',
        subtotal: 0,
        items: [
          { id: 'line-one', quantity: 2 },
          { id: 'line-two', quantity: 1 },
        ],
      } as Quote,
      reconcileOwnedGcodes: false,
      req: req as unknown as PayloadRequest,
    })

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'quotes',
        id: 10,
        data: expect.objectContaining({
          subtotal: 2432,
        }),
      }),
    )
  })
})
