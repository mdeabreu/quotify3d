import type { PayloadRequest } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { recomputeQuoteFromOwnedGcodes } from '@/collections/Quotes/hooks/recomputeQuoteFromOwnedGcodes'
import type { Gcode, Quote } from '@/payload-types'

const configuredItem = {
  filament: 1,
  filamentSlots: [{ colour: 10 }, { colour: 11 }, { colour: 12 }],
  id: 'line-one',
  machine: 3,
  model: 4,
  process: 2,
  quantity: 1,
}

const ownedGcode = (overrides: Partial<Gcode> = {}) =>
  ({
    filament: 1,
    filamentSlots: [{ colour: 10 }, { colour: 11 }, { colour: 12 }],
    id: 9,
    machine: 3,
    model: 4,
    process: 2,
    quote: 7,
    quoteItemID: 'line-one',
    status: 'sliced',
    ...overrides,
  }) as Gcode

const harness = (gcode: Gcode) => {
  const create = vi.fn()
  const deleteRecord = vi.fn()
  const update = vi.fn(async (args) =>
    args.collection === 'gcodes' ? { ...gcode, ...args.data } : args.data,
  )
  const req = {
    payload: {
      create,
      delete: deleteRecord,
      find: vi.fn(async ({ collection }: { collection: string }) =>
        collection === 'gcodes'
          ? { docs: [gcode] }
          : {
              docs: [10, 11, 12].map((id) => ({
                active: true,
                colour: { active: true, id },
                material: { active: true, id: 1 },
              })),
            },
      ),
      findByID: vi.fn(async ({ collection }: { collection: string }) =>
        collection === 'models' ? { filamentSlotCount: 3 } : { active: true },
      ),
      update,
    },
  } as unknown as PayloadRequest
  return { create, deleteRecord, req, update }
}

describe('quote G-code reconciliation', () => {
  it('unlinks incomplete items without changing their owned G-code', async () => {
    const gcode = ownedGcode()
    const { create, req, update } = harness(gcode)

    await recomputeQuoteFromOwnedGcodes({
      quote: {
        id: 7,
        items: [
          { ...configuredItem, filamentSlots: [{ colour: 10 }, {}, { colour: 12 }], gcode: 9 },
        ],
        status: 'queued',
        subtotal: 100,
      } as Quote,
      reconcileOwnedGcodes: true,
      req,
    })

    expect(create).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalledWith(expect.objectContaining({ collection: 'gcodes' }))
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'quotes',
        data: expect.objectContaining({
          items: [expect.objectContaining({ gcode: null })],
          status: 'new',
          subtotal: 0,
        }),
      }),
    )
  })

  it('relinks an exact cached configuration without reslicing', async () => {
    const gcode = ownedGcode({ estimatedPrice: 250 })
    const { req, update } = harness(gcode)

    await recomputeQuoteFromOwnedGcodes({
      quote: {
        id: 7,
        items: [{ ...configuredItem, gcode: null }],
        status: 'queued',
        subtotal: 0,
      } as Quote,
      reconcileOwnedGcodes: true,
      req,
    })

    expect(update).not.toHaveBeenCalledWith(expect.objectContaining({ collection: 'gcodes' }))
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'quotes',
        data: expect.objectContaining({
          items: [expect.objectContaining({ gcode: 9 })],
          status: 'sliced',
          subtotal: 250,
        }),
      }),
    )
  })

  it('clears cached results and queues a changed complete configuration', async () => {
    const gcode = ownedGcode({ estimatedPrice: 250 })
    const { req, update } = harness(gcode)

    await recomputeQuoteFromOwnedGcodes({
      quote: {
        id: 7,
        items: [
          { ...configuredItem, filamentSlots: [{ colour: 10 }, { colour: 12 }, { colour: 12 }] },
        ],
        status: 'queued',
        subtotal: 0,
      } as Quote,
      reconcileOwnedGcodes: true,
      req,
    })

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'gcodes',
        id: 9,
        data: expect.objectContaining({
          estimatedPrice: null,
          filamentSlots: [{ colour: 10 }, { colour: 12 }, { colour: 12 }],
          status: 'queued',
        }),
      }),
    )
  })

  it('excludes a linked stale configuration from status and totals', async () => {
    const gcode = ownedGcode({
      estimatedPrice: 250,
      filamentSlots: [{ colour: 10 }, { colour: 12 }, { colour: 12 }],
    })
    const { req, update } = harness(gcode)

    await recomputeQuoteFromOwnedGcodes({
      quote: {
        id: 7,
        items: [{ ...configuredItem, gcode: 9 }],
        status: 'sliced',
        subtotal: 250,
      } as Quote,
      reconcileOwnedGcodes: false,
      req,
    })

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'quotes',
        data: expect.objectContaining({ status: 'queued', subtotal: 0 }),
      }),
    )
  })
})
