import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { QuoteDetailsWorkspace, shouldAutoRefreshQuote } from '@/components/QuoteDetailsWorkspace'

const refresh = vi.fn()

afterEach(() => {
  cleanup()
})

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
  spoolOptions: [],
  submitForReviewAction: async () => {},
}

const materialOptions = [
  {
    description: null,
    id: 1,
    imageUrl: null,
    name: 'PLA',
  },
  {
    description: null,
    id: 2,
    imageUrl: null,
    name: 'PETG',
  },
]

const colourOptions = [
  {
    description: null,
    id: 10,
    imageUrl: null,
    name: 'Red',
  },
  {
    description: null,
    id: 11,
    imageUrl: null,
    name: 'Black',
  },
]

const qualityOptions = [
  {
    description: null,
    id: 20,
    imageUrl: null,
    name: 'Standard',
  },
]

const spoolOptions = [
  {
    id: 100,
    filament: materialOptions[0],
    colour: colourOptions[0],
  },
  {
    id: 101,
    filament: materialOptions[1],
    colour: colourOptions[1],
  },
]

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

    expect(
      screen.getByText('Updating estimates automatically while slicing finishes.'),
    ).toBeTruthy()

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
    const { rerender } = render(
      <QuoteDetailsWorkspace {...baseProps} hasPendingPrices quoteStatus="queued" />,
    )

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

describe('QuoteDetailsWorkspace material availability', () => {
  it('filters colours to active spool combinations for the selected material', () => {
    render(
      <QuoteDetailsWorkspace
        {...baseProps}
        colourOptions={colourOptions}
        items={[
          {
            colourId: '10',
            colourLabel: 'Red',
            filamentId: '1',
            filamentLabel: 'PLA',
            gcodeDuration: null,
            gcodePrice: null,
            gcodeStatus: null,
            gcodeWeight: null,
            id: 'item-1',
            modelLabel: 'benchy.stl',
            processId: '20',
            processLabel: 'Standard',
            quantity: 1,
            spoolId: '100',
          },
        ]}
        materialOptions={materialOptions}
        qualityOptions={qualityOptions}
        spoolOptions={spoolOptions}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /edit item/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Colour' }))

    expect(screen.getAllByText('Red').length).toBeGreaterThan(0)
    expect(screen.queryByText('Black')).toBeNull()
  })

  it('filters materials to active spool combinations for the selected colour', () => {
    render(
      <QuoteDetailsWorkspace
        {...baseProps}
        colourOptions={colourOptions}
        items={[
          {
            colourId: '11',
            colourLabel: 'Black',
            filamentId: '2',
            filamentLabel: 'PETG',
            gcodeDuration: null,
            gcodePrice: null,
            gcodeStatus: null,
            gcodeWeight: null,
            id: 'item-1',
            modelLabel: 'benchy.stl',
            processId: '20',
            processLabel: 'Standard',
            quantity: 1,
            spoolId: '101',
          },
        ]}
        materialOptions={materialOptions}
        qualityOptions={qualityOptions}
        spoolOptions={spoolOptions}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /edit item/i }))

    expect(screen.getAllByText('PETG').length).toBeGreaterThan(0)
    expect(screen.queryByText('PLA')).toBeNull()
  })
})
