import { render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  QuoteDetailsWorkspace,
  shouldAutoRefreshQuote,
} from '@/components/QuoteDetailsWorkspace'

const refresh = vi.fn()

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={typeof href === 'string' ? href : '#'} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh,
  }),
}))

const baseProps = {
  addModelsAction: async () => {},
  colourOptions: [],
  editable: true,
  hasFailedItems: false,
  hasInProgressItems: false,
  hasPendingPrices: false,
  items: [],
  materialOptions: [],
  qualityOptions: [],
  quoteID: 42,
  quoteStatus: 'sliced' as const,
  refreshEstimatesAction: async () => {},
  removeItemAction: async () => {},
  saveItemAction: async () => {},
  submitForReviewAction: async () => {},
}

describe('QuoteDetailsWorkspace auto refresh', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    refresh.mockReset()

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('refreshes the route while processing is in progress', () => {
    render(<QuoteDetailsWorkspace {...baseProps} hasPendingPrices quoteStatus="queued" />)

    expect(screen.getByText('Updating estimates automatically while slicing finishes.')).toBeTruthy()

    vi.advanceTimersByTime(3000)
    expect(refresh).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(3000)
    expect(refresh).toHaveBeenCalledTimes(2)
  })

  it('does not refresh while the tab is hidden', () => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    })

    render(<QuoteDetailsWorkspace {...baseProps} hasPendingPrices quoteStatus="queued" />)

    vi.advanceTimersByTime(6000)
    expect(refresh).not.toHaveBeenCalled()
  })

  it('stops refreshing when the quote is not eligible for auto refresh', () => {
    const { rerender } = render(<QuoteDetailsWorkspace {...baseProps} hasPendingPrices quoteStatus="queued" />)

    vi.advanceTimersByTime(3000)
    expect(refresh).toHaveBeenCalledTimes(1)

    rerender(<QuoteDetailsWorkspace {...baseProps} />)

    vi.advanceTimersByTime(6000)
    expect(refresh).toHaveBeenCalledTimes(1)
  })
})

describe('shouldAutoRefreshQuote', () => {
  it('returns true for queued editable quotes with pending pricing', () => {
    expect(
      shouldAutoRefreshQuote({
        editable: true,
        hasFailedItems: false,
        hasInProgressItems: false,
        hasPendingPrices: true,
        quoteStatus: 'queued',
      }),
    ).toBe(true)
  })

  it('returns false for non-editable quotes', () => {
    expect(
      shouldAutoRefreshQuote({
        editable: false,
        hasFailedItems: false,
        hasInProgressItems: true,
        hasPendingPrices: true,
        quoteStatus: 'queued',
      }),
    ).toBe(false)
  })

  it('returns false for failed line items', () => {
    expect(
      shouldAutoRefreshQuote({
        editable: true,
        hasFailedItems: true,
        hasInProgressItems: false,
        hasPendingPrices: true,
        quoteStatus: 'queued',
      }),
    ).toBe(false)
  })
})
