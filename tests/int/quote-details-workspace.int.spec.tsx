import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { QuoteDetailsWorkspace, shouldAutoRefreshQuote } from '@/components/QuoteDetailsWorkspace'

const refresh = vi.fn()
const ecommerceMocks = vi.hoisted(() => ({
  addItem: vi.fn(async () => {}),
}))

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

vi.mock('@payloadcms/plugin-ecommerce/client/react', () => ({
  useCart: () => ({
    addItem: ecommerceMocks.addItem,
    isLoading: false,
  }),
  useCurrency: () => ({
    formatCurrency: (amount: number) => `$${amount.toFixed(2)}`,
    supportedCurrencies: [{ code: 'USD' }],
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
    pricePerGram: 0.18,
  },
  {
    description: null,
    id: 2,
    imageUrl: null,
    name: 'PETG',
    pricePerGram: 0.24,
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

const failedItem = {
  colourId: '10',
  colourLabel: 'Red',
  filamentId: '1',
  filamentLabel: 'PLA',
  gcodeDuration: null,
  gcodePrice: null,
  gcodeStatus: 'failed',
  gcodeWeight: null,
  id: 'item-1',
  modelLabel: 'benchy.stl',
  processId: '20',
  processLabel: 'Standard',
  quantity: 1,
  spoolId: '100',
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

describe('QuoteDetailsWorkspace failed slice notice', () => {
  it('shows manual-review guidance for editable quotes with failed items', () => {
    render(<QuoteDetailsWorkspace {...baseProps} hasFailedItems items={[failedItem]} />)

    expect(screen.getByText('Some files need manual review')).toBeTruthy()
    expect(
      screen.getByText(
        'The instant quote may not be accurate for models that could not be sliced automatically. Send this quote for review and we will calculate the correct price for those files.',
      ),
    ).toBeTruthy()
  })

  it('does not show manual-review guidance when there are no failed items', () => {
    render(<QuoteDetailsWorkspace {...baseProps} />)

    expect(screen.queryByText('Some files need manual review')).toBeNull()
  })

  it('does not show manual-review guidance for non-editable quotes', () => {
    render(
      <QuoteDetailsWorkspace
        {...baseProps}
        editable={false}
        hasFailedItems
        items={[failedItem]}
      />,
    )

    expect(screen.queryByText('Some files need manual review')).toBeNull()
  })
})

describe('QuoteDetailsWorkspace material availability', () => {
  beforeEach(() => {
    ecommerceMocks.addItem.mockClear()
  })

  it('shows refresh copy for unsliced line items that need a new estimate', () => {
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
            gcodeStatus: 'new',
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
        quoteStatus="new"
        spoolOptions={spoolOptions}
      />,
    )

    expect(screen.getByText('Refresh estimate needed')).toBeTruthy()
    expect(screen.queryByText('Estimate in progress')).toBeNull()
  })

  it('keeps in-progress copy for queued line items', () => {
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
            gcodeStatus: 'queued',
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
        quoteStatus="queued"
        spoolOptions={spoolOptions}
      />,
    )

    expect(screen.getByText('Estimate in progress')).toBeTruthy()
  })

  it('keeps quote-linked products addable from the quote page', async () => {
    render(
      <QuoteDetailsWorkspace
        {...baseProps}
        editable={false}
        items={[
          {
            colourId: '10',
            colourLabel: 'Red',
            filamentId: '1',
            filamentLabel: 'PLA',
            gcodeDuration: 3600,
            gcodePrice: 12,
            gcodeStatus: 'sliced',
            gcodeWeight: 25,
            id: 'item-1',
            modelLabel: 'benchy.stl',
            processId: '20',
            processLabel: 'Standard',
            productID: 99,
            quantity: 2,
            spoolId: '100',
          },
        ]}
        quoteStatus="approved"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /add quote item to cart/i }))

    expect(ecommerceMocks.addItem).toHaveBeenCalledWith({ product: 99 }, 2)
  })

  it('shows all active materials in the material step', () => {
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

    expect(screen.getAllByText('PLA').length).toBeGreaterThan(0)
    expect(screen.getByText('PETG')).toBeTruthy()
    expect(screen.getByText('$0.18')).toBeTruthy()
    expect(screen.getByText('$0.24')).toBeTruthy()
  })

  it('filters colours after a material is selected', () => {
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
    fireEvent.click(screen.getByRole('button', { name: /PETG/ }))
    const dialog = screen.getByRole('dialog')

    expect(screen.getByText('Showing colours available for PETG.')).toBeTruthy()
    expect(within(dialog).getAllByText('Black').length).toBeGreaterThan(0)
    expect(within(dialog).queryByRole('button', { name: /Red/ })).toBeNull()
  })

  it('disables save until a compatible colour is selected after changing material', () => {
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
    fireEvent.click(screen.getByRole('button', { name: /PETG/ }))

    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Save' }).disabled).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: /Black/ }))

    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Save' }).disabled).toBe(false)
  })
})
