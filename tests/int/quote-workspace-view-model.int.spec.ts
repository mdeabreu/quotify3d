import type { Payload } from 'payload'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Gcode, Quote } from '@/payload-types'

const { analyzeQuoteItemConfiguration } = vi.hoisted(() => ({
  analyzeQuoteItemConfiguration: vi.fn(),
}))

vi.mock('@/lib/quotes/quoteItemConfiguration', () => ({
  analyzeQuoteItemConfiguration,
}))

import { buildQuoteWorkspaceViewModel } from '@/lib/quotes/workspaceViewModel'

const payload = {
  find: vi.fn(async () => ({ docs: [] })),
} as unknown as Payload

const quoteItem = (
  overrides: Partial<Quote['items'][number]> = {},
): Quote['items'][number] => ({
  filament: 1,
  filamentSlots: [{ colour: 10 }],
  gcode: 9,
  id: 'line-one',
  machine: 3,
  model: 4,
  process: 2,
  quantity: 1,
  ...overrides,
})

const quote = (item: Quote['items'][number]): Quote =>
  ({
    createdAt: '2026-07-24T00:00:00.000Z',
    id: 4,
    items: [item],
    status: 'queued',
    updatedAt: '2026-07-24T00:00:00.000Z',
  }) as Quote

const analysis = (complete = true) => ({
  complete,
  configuration: complete
    ? {
        filament: 1,
        filamentSlots: [{ colour: 10 }],
        machine: 3,
        model: 4,
        process: 2,
      }
    : null,
  configurationKey: complete ? 'current-configuration' : null,
  issues: complete ? [] : [{ code: 'missing-process' as const }],
  slotColourIDs: [10],
  slotCount: 1,
})

const buildItem = async (item: Quote['items'][number]) => {
  const result = await buildQuoteWorkspaceViewModel({
    accessToken: '',
    email: '',
    payload,
    quote: quote(item),
    user: null,
  })

  return result.items[0]
}

describe('buildQuoteWorkspaceViewModel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    analyzeQuoteItemConfiguration.mockResolvedValue(analysis())
  })

  it('preserves a sliced estimate when the restricted G-code relationship is an ID', async () => {
    const item = await buildItem(
      quoteItem({
        gcode: 9,
        gcodeDuration: 2731,
        gcodePrice: 112,
        gcodeStatus: 'sliced',
        gcodeWeight: 11.24,
      }),
    )

    expect(item).toMatchObject({
      configured: true,
      gcodeDuration: 2731,
      gcodePrice: 112,
      gcodeStatus: 'sliced',
      gcodeWeight: 11.24,
    })
  })

  it('preserves a terminal slicing failure when estimate metrics are unavailable', async () => {
    const item = await buildItem(
      quoteItem({
        gcode: 9,
        gcodeDuration: null,
        gcodePrice: null,
        gcodeStatus: 'failed',
        gcodeWeight: null,
      }),
    )

    expect(item).toMatchObject({
      configured: true,
      gcodeDuration: null,
      gcodePrice: null,
      gcodeStatus: 'failed',
      gcodeWeight: null,
    })
  })

  it('suppresses estimate fields when the saved configuration is incomplete', async () => {
    analyzeQuoteItemConfiguration.mockResolvedValueOnce(analysis(false))

    const item = await buildItem(
      quoteItem({
        gcode: 9,
        gcodeDuration: 2731,
        gcodePrice: 112,
        gcodeStatus: 'sliced',
        gcodeWeight: 11.24,
      }),
    )

    expect(item).toMatchObject({
      configured: false,
      gcodeDuration: null,
      gcodePrice: null,
      gcodeStatus: null,
      gcodeWeight: null,
    })
  })

  it('suppresses estimate fields when no G-code relationship is linked', async () => {
    const item = await buildItem(
      quoteItem({
        gcode: null,
        gcodeDuration: 2731,
        gcodePrice: 112,
        gcodeStatus: 'sliced',
        gcodeWeight: 11.24,
      }),
    )

    expect(item).toMatchObject({
      gcodeDuration: null,
      gcodePrice: null,
      gcodeStatus: null,
      gcodeWeight: null,
    })
  })

  it('continues to preserve estimates for populated G-code relationships', async () => {
    const item = await buildItem(
      quoteItem({
        gcode: { id: 9 } as Gcode,
        gcodeDuration: 2731,
        gcodePrice: 112,
        gcodeStatus: 'sliced',
        gcodeWeight: 11.24,
      }),
    )

    expect(item).toMatchObject({
      gcodeDuration: 2731,
      gcodePrice: 112,
      gcodeStatus: 'sliced',
      gcodeWeight: 11.24,
    })
  })
})
