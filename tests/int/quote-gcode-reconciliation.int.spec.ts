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

const harness = (initialGcodes: Gcode[]) => {
  let gcodes = [...initialGcodes]
  const create = vi.fn(async ({ data }: { data: Partial<Gcode> }) => {
    const created = ownedGcode({ ...data, id: Math.max(0, ...gcodes.map(({ id }) => id)) + 1 })
    gcodes.push(created)
    return created
  })
  const deleteRecord = vi.fn(async ({ id }: { id: number }) => {
    gcodes = gcodes.filter((gcode) => gcode.id !== id)
  })
  const update = vi.fn(async (args) => {
    if (args.collection !== 'gcodes') return args.data
    const current = gcodes.find((gcode) => gcode.id === args.id) as Gcode
    const updated = { ...current, ...args.data }
    gcodes = gcodes.map((gcode) => (gcode.id === args.id ? updated : gcode))
    return updated
  })
  const req = {
    payload: {
      create,
      delete: deleteRecord,
      find: vi.fn(async ({ collection }: { collection: string }) =>
        collection === 'gcodes'
          ? { docs: gcodes }
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
  return { create, deleteRecord, getGcodes: () => gcodes, req, update }
}

describe('quote G-code reconciliation', () => {
  it('unlinks incomplete items without changing their cached snapshots', async () => {
    const gcode = ownedGcode()
    const { create, deleteRecord, req, update } = harness([gcode])

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
    expect(deleteRecord).not.toHaveBeenCalled()
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

  it('creates a new snapshot without modifying the previous configuration', async () => {
    const original = ownedGcode({ estimatedPrice: 250 })
    const { create, getGcodes, req, update } = harness([original])

    await recomputeQuoteFromOwnedGcodes({
      quote: {
        id: 7,
        items: [{ ...configuredItem, gcode: 9, process: 5 }],
        status: 'queued',
        subtotal: 250,
      } as Quote,
      reconcileOwnedGcodes: true,
      req,
    })

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'gcodes',
        data: expect.objectContaining({ process: 5, quoteItemID: 'line-one', status: 'queued' }),
      }),
    )
    expect(update).not.toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'gcodes', id: original.id }),
    )
    expect(getGcodes()).toHaveLength(2)
    expect(getGcodes()[0]).toMatchObject({ estimatedPrice: 250, id: 9, process: 2 })
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'quotes',
        data: expect.objectContaining({
          items: [expect.objectContaining({ gcode: 10, process: 5 })],
          subtotal: 0,
        }),
      }),
    )
  })

  it('restores an earlier exact snapshot with results and overrides intact', async () => {
    const original = ownedGcode({
      durationOverride: 400,
      estimatedDuration: 500,
      estimatedPrice: 250,
      priceOverride: 300,
      weightOverride: 20,
    })
    const alternate = ownedGcode({ id: 10, process: 5, status: 'sliced' })
    const { create, getGcodes, req, update } = harness([original, alternate])

    await recomputeQuoteFromOwnedGcodes({
      quote: {
        id: 7,
        items: [{ ...configuredItem, gcode: 10 }],
        status: 'queued',
        subtotal: 0,
      } as Quote,
      reconcileOwnedGcodes: true,
      req,
    })

    expect(create).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalledWith(expect.objectContaining({ collection: 'gcodes' }))
    expect(getGcodes()[0]).toMatchObject({
      durationOverride: 400,
      estimatedDuration: 500,
      priceOverride: 300,
      weightOverride: 20,
    })
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'quotes',
        data: expect.objectContaining({
          items: [expect.objectContaining({ gcode: 9 })],
          status: 'sliced',
          subtotal: 300,
        }),
      }),
    )
  })

  it.each(['failed', 'slicing'] as const)(
    'relinks a matching %s snapshot without retrying it',
    async (status) => {
      const matching = ownedGcode({ id: 9, status })
      const alternate = ownedGcode({ id: 10, process: 5 })
      const { create, req, update } = harness([matching, alternate])

      await recomputeQuoteFromOwnedGcodes({
        quote: {
          id: 7,
          items: [{ ...configuredItem, gcode: 10 }],
          status: 'queued',
          subtotal: 0,
        } as Quote,
        reconcileOwnedGcodes: true,
        req,
      })

      expect(create).not.toHaveBeenCalled()
      expect(update).not.toHaveBeenCalledWith(expect.objectContaining({ collection: 'gcodes' }))
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'quotes',
          data: expect.objectContaining({ items: [expect.objectContaining({ gcode: 9 })] }),
        }),
      )
    },
  )

  it('ignores an inactive snapshot when deriving current status and totals', async () => {
    const inactive = ownedGcode({ estimatedPrice: 250 })
    const active = ownedGcode({ id: 10, process: 5, status: 'slicing' })
    const { req, update } = harness([inactive, active])

    await recomputeQuoteFromOwnedGcodes({
      quote: {
        id: 7,
        items: [{ ...configuredItem, gcode: 10, process: 5 }],
        status: 'queued',
        subtotal: 0,
      } as Quote,
      reconcileOwnedGcodes: false,
      req,
    })

    expect(update).not.toHaveBeenCalled()
  })

  it('keeps the current snapshot when only quantity or notes change', async () => {
    const current = ownedGcode({ estimatedPrice: 250 })
    const { create, req, update } = harness([current])

    await recomputeQuoteFromOwnedGcodes({
      quote: {
        id: 7,
        items: [
          {
            ...configuredItem,
            filamentSlots: [
              { colour: 10, description: 'Body' },
              { colour: 11, description: 'Eyes' },
              { colour: 12, description: 'Details' },
            ],
            gcode: 9,
            notes: 'Handle with care',
            quantity: 3,
          },
        ],
        status: 'sliced',
        subtotal: 750,
      } as Quote,
      reconcileOwnedGcodes: true,
      req,
    })

    expect(create).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it('deletes every cached snapshot belonging to a removed item', async () => {
    const removedA = ownedGcode({ quoteItemID: 'removed-item' })
    const removedB = ownedGcode({ id: 10, process: 5, quoteItemID: 'removed-item' })
    const current = ownedGcode({ id: 11 })
    const { deleteRecord, req } = harness([removedA, removedB, current])

    await recomputeQuoteFromOwnedGcodes({
      quote: {
        id: 7,
        items: [{ ...configuredItem, gcode: 11 }],
        status: 'sliced',
        subtotal: 0,
      } as Quote,
      reconcileOwnedGcodes: true,
      req,
    })

    expect(deleteRecord).toHaveBeenCalledTimes(2)
    expect(deleteRecord).toHaveBeenCalledWith(expect.objectContaining({ id: 9 }))
    expect(deleteRecord).toHaveBeenCalledWith(expect.objectContaining({ id: 10 }))
  })
})
