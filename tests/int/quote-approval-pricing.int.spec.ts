import { APIError } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import {
  ensurePricedItemsBeforeApproval,
  getApprovedPrice,
} from '@/collections/Quotes/hooks/ensurePricedItemsBeforeApproval'

const callHook = async ({
  data,
  gcodesByID = {},
  originalDoc,
}: {
  data: Record<string, unknown>
  gcodesByID?: Record<number, { estimatedPrice?: unknown; priceOverride?: unknown }>
  originalDoc?: Record<string, unknown>
}) => {
  const findByID = vi.fn(async ({ id }: { id: number }) => gcodesByID[id] ?? {})

  return ensurePricedItemsBeforeApproval({
    data,
    operation: originalDoc ? 'update' : 'create',
    originalDoc,
    req: {
      payload: {
        findByID,
      },
    },
  } as unknown as Parameters<typeof ensurePricedItemsBeforeApproval>[0])
}

describe('getApprovedPrice', () => {
  it('uses a finite price override before an estimate', () => {
    expect(getApprovedPrice({ estimatedPrice: 10, priceOverride: 12 })).toBe(12)
  })

  it('falls back to a finite estimate', () => {
    expect(getApprovedPrice({ estimatedPrice: 10 })).toBe(10)
  })

  it('rounds approved prices to integer minor units', () => {
    expect(getApprovedPrice({ estimatedPrice: 1932.7000000000003 })).toBe(1933)
    expect(getApprovedPrice({ estimatedPrice: 10, priceOverride: 12.4 })).toBe(12)
  })

  it('ignores non-finite prices', () => {
    expect(getApprovedPrice({ estimatedPrice: Number.POSITIVE_INFINITY })).toBeUndefined()
    expect(getApprovedPrice({ priceOverride: Number.NaN })).toBeUndefined()
  })
})

describe('ensurePricedItemsBeforeApproval', () => {
  it('allows approval when every quote item has a gcode price override', async () => {
    const data = {
      status: 'approved',
      items: [{ gcode: 1 }, { gcode: 2 }],
    }

    await expect(
      callHook({
        data,
        gcodesByID: {
          1: { priceOverride: 12 },
          2: { priceOverride: 20 },
        },
      }),
    ).resolves.toBe(data)
  })

  it('allows approval when every quote item has a gcode estimate', async () => {
    const data = {
      status: 'approved',
      items: [{ gcode: 1 }, { gcode: 2 }],
    }

    await expect(
      callHook({
        data,
        gcodesByID: {
          1: { estimatedPrice: 12 },
          2: { estimatedPrice: 20 },
        },
      }),
    ).resolves.toBe(data)
  })

  it('blocks approval when an item has no gcode', async () => {
    await expect(
      callHook({
        data: {
          status: 'approved',
          items: [{ gcode: 1 }, {}],
        },
        gcodesByID: {
          1: { estimatedPrice: 12 },
        },
      }),
    ).rejects.toBeInstanceOf(APIError)
  })

  it('blocks approval when a related gcode has no price', async () => {
    await expect(
      callHook({
        data: {
          status: 'approved',
          items: [{ gcode: 1 }, { gcode: 2 }],
        },
        gcodesByID: {
          1: { estimatedPrice: 12 },
          2: {},
        },
      }),
    ).rejects.toThrow('Missing prices for line 2')
  })

  it('blocks approval when a related gcode has a non-finite price', async () => {
    await expect(
      callHook({
        data: {
          status: 'approved',
          items: [{ gcode: 1 }],
        },
        gcodesByID: {
          1: { estimatedPrice: Number.POSITIVE_INFINITY },
        },
      }),
    ).rejects.toThrow('Missing prices for line 1')
  })

  it('uses original quote items when an update only changes status', async () => {
    await expect(
      callHook({
        data: {
          status: 'approved',
        },
        originalDoc: {
          status: 'in-review',
          items: [{ gcode: 1 }],
        },
        gcodesByID: {
          1: { estimatedPrice: 12 },
        },
      }),
    ).resolves.toMatchObject({ status: 'approved' })
  })
})
