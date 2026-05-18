import { describe, expect, it, vi } from 'vitest'

import { normalizeQuoteItemSpools } from '@/collections/Quotes/hooks/normalizeQuoteItemSpools'
import { buildAvailableSpoolOptions } from '@/lib/spoolAvailability'

const activeMaterial = {
  active: true,
  description: 'Easy printing.',
  id: 1,
  image: null,
  name: 'PLA',
  pricePerGram: 0.18,
}

const activeColour = {
  active: true,
  description: 'Bright red.',
  finish: 'regular',
  id: 10,
  image: null,
  name: 'Red',
  swatches: [],
  type: 'solid',
}

const makeReq = ({
  find = vi.fn(),
  findByID = vi.fn(),
}: {
  find?: ReturnType<typeof vi.fn>
  findByID?: ReturnType<typeof vi.fn>
}) =>
  ({
    payload: {
      find,
      findByID,
    },
  }) as never

describe('buildAvailableSpoolOptions', () => {
  it('collapses duplicate active spool pairs to the lowest spool id', () => {
    expect(
      buildAvailableSpoolOptions([
        {
          active: true,
          colour: activeColour,
          id: 22,
          material: activeMaterial,
        },
        {
          active: true,
          colour: activeColour,
          id: 21,
          material: activeMaterial,
        },
      ] as never),
    ).toEqual([
      {
        colour: {
          description: 'Bright red.',
          id: 10,
          imageUrl: null,
          name: 'Red',
        },
        filament: {
          description: 'Easy printing.',
          id: 1,
          imageUrl: null,
          name: 'PLA',
          pricePerGram: 0.18,
        },
        id: 21,
      },
    ])
  })
})

describe('normalizeQuoteItemSpools', () => {
  it('accepts an active spool and populates the quote item pair', async () => {
    const findByID = vi.fn().mockResolvedValue({
      active: true,
      colour: activeColour,
      id: 21,
      material: activeMaterial,
    })
    const req = makeReq({ findByID })

    await expect(
      normalizeQuoteItemSpools({
        data: {
          items: [
            {
              colour: 10,
              filament: 1,
              spool: 21,
            },
          ],
        },
        operation: 'create',
        req,
      } as never),
    ).resolves.toMatchObject({
      items: [
        {
          colour: 10,
          filament: 1,
          spool: 21,
        },
      ],
    })
  })

  it('rejects inactive spool-backed combinations', async () => {
    const findByID = vi.fn().mockResolvedValue({
      active: true,
      colour: activeColour,
      id: 21,
      material: {
        ...activeMaterial,
        active: false,
      },
    })
    const req = makeReq({ findByID })

    await expect(
      normalizeQuoteItemSpools({
        data: {
          items: [
            {
              colour: 10,
              filament: 1,
              spool: 21,
            },
          ],
        },
        operation: 'create',
        req,
      } as never),
    ).rejects.toThrow('Selected spool is no longer available.')
  })

  it('derives a canonical active spool from a material and colour pair', async () => {
    const find = vi.fn().mockResolvedValue({
      docs: [
        {
          active: true,
          colour: activeColour,
          id: 21,
          material: activeMaterial,
        },
      ],
    })
    const req = makeReq({ find })

    await expect(
      normalizeQuoteItemSpools({
        data: {
          items: [
            {
              colour: 10,
              filament: 1,
            },
          ],
        },
        operation: 'create',
        req,
      } as never),
    ).resolves.toMatchObject({
      items: [
        {
          colour: 10,
          filament: 1,
          spool: 21,
        },
      ],
    })
  })
})
