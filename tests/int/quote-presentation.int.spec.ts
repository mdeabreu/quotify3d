import { describe, expect, it } from 'vitest'

import type { QuoteStatus } from '@/payload-types'
import {
  getCustomerQuoteStatusLabel,
  getQuoteEstimateDisplay,
  getQuoteListActionLabel,
} from '@/utilities/quotes/presentation'

describe('customer quote presentation', () => {
  it.each<[QuoteStatus, string, string]>([
    ['new', 'Draft', 'Continue quote'],
    ['queued', 'Creating estimate', 'Continue quote'],
    ['sliced', 'Estimate ready', 'Continue quote'],
    ['ready-for-review', 'Submitted', 'View request'],
    ['in-review', 'In review', 'View request'],
    ['approved', 'Approved', 'View quote'],
    ['rejected', 'Unable to quote', 'View details'],
  ])('presents %s as %s with the correct action', (status, label, action) => {
    expect(getCustomerQuoteStatusLabel(status)).toBe(label)
    expect(getQuoteListActionLabel(status)).toBe(action)
  })

  it('omits a zero amount while estimates are pending', () => {
    expect(
      getQuoteEstimateDisplay({
        items: [{ gcodePrice: null, gcodeStatus: 'queued', quantity: 1 }],
        status: 'queued',
      }),
    ).toEqual({ amount: null, label: 'Estimate pending' })
  })

  it('calls out manual pricing when every automatic estimate failed', () => {
    expect(
      getQuoteEstimateDisplay({
        items: [{ gcodePrice: null, gcodeStatus: 'failed', quantity: 1 }],
        status: 'queued',
      }),
    ).toEqual({ amount: null, label: 'Manual pricing required' })
  })

  it('shows only priced models in a partial estimate', () => {
    expect(
      getQuoteEstimateDisplay({
        items: [
          { gcodePrice: 1250, gcodeStatus: 'sliced', quantity: 2 },
          { gcodePrice: null, gcodeStatus: 'queued', quantity: 1 },
        ],
        status: 'queued',
      }),
    ).toEqual({ amount: 2500, label: 'Partial estimate' })
  })

  it('distinguishes a complete estimate from an approved total', () => {
    const items = [{ gcodePrice: 1250, gcodeStatus: 'sliced', quantity: 2 }]
    expect(getQuoteEstimateDisplay({ items, status: 'sliced' })).toEqual({
      amount: 2500,
      label: 'Estimated total',
    })
    expect(getQuoteEstimateDisplay({ items, status: 'approved' })).toEqual({
      amount: 2500,
      label: 'Total',
    })
  })
})
