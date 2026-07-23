import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  QuoteDetailsWorkspace,
  shouldAutoRefreshQuote,
  type QuoteWorkspaceItem,
} from '@/components/QuoteDetailsWorkspace'

const refresh = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}))

vi.mock('@/components/ModelPreviewer', () => ({
  ModelPreviewer: ({ colors }: { colors: string[] }) => (
    <div data-testid="model-preview">{colors.join(',')}</div>
  ),
}))

vi.mock('@/providers/Branding', () => ({
  useBranding: () => ({ quoteProductPlaceholder: '/placeholder.png' }),
}))

vi.mock('@payloadcms/plugin-ecommerce/client/react', () => ({
  useCurrency: () => ({
    formatCurrency: (amount: number) => `$${amount.toFixed(2)}`,
    supportedCurrencies: [{ code: 'USD' }],
  }),
}))

const item = (overrides: Partial<QuoteWorkspaceItem> = {}): QuoteWorkspaceItem => ({
  configurationIssues: [],
  configured: false,
  filamentId: '',
  filamentLabel: '',
  filamentSlots: [],
  gcodeDuration: null,
  gcodePrice: null,
  gcodeStatus: null,
  gcodeWeight: null,
  id: 'item-1',
  modelLabel: 'model.3mf',
  modelNote: '',
  modelSlotCount: 2,
  modelURL: '/model',
  processId: '',
  processLabel: '',
  quantity: 1,
  ...overrides,
})

const props = {
  addModelsAction: async () => {},
  editable: true,
  items: [item()],
  materialOptions: [
    {
      id: 1,
      kind: 'filament' as const,
      name: 'PLA',
      pricePerGram: 0.2,
      description: null,
      imageUrl: null,
    },
  ],
  qualityOptions: [
    { id: 20, kind: 'process' as const, name: 'Standard', description: null, imageUrl: null },
  ],
  quoteID: 42,
  quoteStatus: 'new' as const,
  removeItemAction: async () => {},
  saveItemAction: async () => ({ success: true as const }),
  spoolOptions: [
    {
      id: 100,
      colour: {
        id: 10,
        kind: 'colour' as const,
        name: 'Red',
        swatches: ['#ff0000'],
        finish: null,
        type: null,
        description: null,
        imageUrl: null,
      },
      filament: {
        id: 1,
        kind: 'filament' as const,
        name: 'PLA',
        pricePerGram: 0.2,
        description: null,
        imageUrl: null,
      },
    },
    {
      id: 101,
      colour: {
        id: 11,
        kind: 'colour' as const,
        name: 'Black',
        swatches: ['#111111'],
        finish: null,
        type: null,
        description: null,
        imageUrl: null,
      },
      filament: {
        id: 1,
        kind: 'filament' as const,
        name: 'PLA',
        pricePerGram: 0.2,
        description: null,
        imageUrl: null,
      },
    },
  ],
  submitForReviewAction: async () => {},
}

afterEach(() => {
  cleanup()
  refresh.mockReset()
  vi.restoreAllMocks()
})

describe('QuoteDetailsWorkspace', () => {
  it('shows incomplete items and keeps submission disabled', () => {
    render(<QuoteDetailsWorkspace {...props} />)

    expect(screen.getAllByText('Setup needed').length).toBeGreaterThan(0)
    expect(screen.getByText('Material required').parentElement?.querySelector('svg')).toBeTruthy()
    expect(screen.getAllByText('Colour required')).toHaveLength(2)
    expect(
      screen.getByText('Print profile required').parentElement?.querySelector('svg'),
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Send for review' }).hasAttribute('disabled')).toBe(
      true,
    )
  })

  it('uses a muted warning treatment when an estimate needs manual pricing', () => {
    render(
      <QuoteDetailsWorkspace
        {...props}
        items={[
          item({
            configured: true,
            filamentId: '1',
            filamentLabel: 'PLA',
            filamentSlots: [
              { colourId: '10', colourLabel: 'Red', description: '', hex: '#ff0000' },
              { colourId: '10', colourLabel: 'Red', description: '', hex: '#ff0000' },
            ],
            gcodeStatus: 'failed',
            processId: '20',
            processLabel: 'Standard',
          }),
        ]}
        quoteStatus="queued"
      />,
    )

    expect(screen.getAllByText('Manual pricing')).toHaveLength(3)
    expect(screen.getByText(/We couldn't create an automatic estimate/).className).toContain(
      'text-amber-700',
    )
  })

  it('enables final review once every item is terminal', () => {
    render(
      <QuoteDetailsWorkspace
        {...props}
        items={[
          item({
            configured: true,
            filamentId: '1',
            filamentLabel: 'PLA',
            filamentSlots: [
              { colourId: '10', colourLabel: 'Red', description: 'Body', hex: '#ff0000' },
              { colourId: '11', colourLabel: 'Black', description: 'Eyes', hex: '#111111' },
            ],
            gcodePrice: 12.5,
            gcodeStatus: 'sliced',
            processId: '20',
            processLabel: 'Standard',
          }),
        ]}
        quoteStatus="sliced"
      />,
    )

    const submit = screen.getByRole('button', { name: 'Send for review' })
    expect(submit.hasAttribute('disabled')).toBe(false)
    fireEvent.click(submit)
    expect(screen.getByText('Ready to send your quote request?')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Send quote request' }).parentElement?.className,
    ).toContain('mt-5')
  })

  it('uses choose-and-close for material, colour, and process', () => {
    render(<QuoteDetailsWorkspace {...props} />)

    fireEvent.click(screen.getAllByRole('button', { name: 'Select' })[0])
    expect(screen.getByText('Choose a material')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /PLA/ }))
    expect(screen.queryByText('Choose a material')).toBeNull()

    fireEvent.click(screen.getAllByRole('button', { name: 'Select' })[0])
    expect(screen.getByText('Choose a colour for colour group 1')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Red/ }))
    expect(screen.queryByText('Choose a colour for colour group 1')).toBeNull()

    fireEvent.click(screen.getAllByRole('button', { name: 'Select' }).at(-1)!)
    expect(screen.getByText('Choose a print profile')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Standard/ }))
    expect(screen.queryByText('Choose a print profile')).toBeNull()
  })

  it('updates one persistent preview and applies ordered partial slots once', async () => {
    const saveItemAction = vi.fn(async (_formData: FormData) => ({ success: true as const }))
    render(
      <QuoteDetailsWorkspace
        {...props}
        items={[item({ filamentId: '1', filamentLabel: 'PLA' })]}
        saveItemAction={saveItemAction}
      />,
    )

    expect(screen.getAllByTestId('model-preview')).toHaveLength(1)
    fireEvent.click(screen.getAllByRole('button', { name: 'Select' })[0])
    fireEvent.click(screen.getByRole('button', { name: /Red/ }))
    expect(screen.getByTestId('model-preview').textContent).toBe('#ff0000,#808080')

    const descriptions = screen.getAllByLabelText(/What should this colour apply to/)
    fireEvent.change(descriptions[0], { target: { value: 'Body' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(saveItemAction).toHaveBeenCalledOnce())
    const formData = saveItemAction.mock.calls[0][0]
    expect(JSON.parse(String(formData.get('filamentSlots')))).toEqual([
      { colour: '10', description: 'Body' },
      { colour: '', description: '' },
    ])
    expect(refresh).toHaveBeenCalledOnce()
  })

  it('clears descriptions and shows one row in Same Colour mode', async () => {
    const saveItemAction = vi.fn(async (_formData: FormData) => ({ success: true as const }))
    render(
      <QuoteDetailsWorkspace
        {...props}
        items={[
          item({
            filamentId: '1',
            filamentLabel: 'PLA',
            filamentSlots: [
              { colourId: '10', colourLabel: 'Red', description: 'Body', hex: '#ff0000' },
              { colourId: '10', colourLabel: 'Red', description: 'Eyes', hex: '#ff0000' },
            ],
          }),
        ]}
        saveItemAction={saveItemAction}
      />,
    )

    expect(screen.getByText('Whole model')).toBeTruthy()
    expect(screen.queryByLabelText(/What should this colour apply to/)).toBeNull()
    fireEvent.click(screen.getAllByRole('button', { name: 'Change' })[1])
    fireEvent.click(screen.getByRole('button', { name: /Black/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(saveItemAction).toHaveBeenCalledOnce())
    const formData = saveItemAction.mock.calls[0][0]
    expect(JSON.parse(String(formData.get('filamentSlots')))).toEqual([
      { colour: '11', description: '' },
      { colour: '11', description: '' },
    ])
  })

  it('dims a saved estimate while slicing settings are unapplied', () => {
    render(
      <QuoteDetailsWorkspace
        {...props}
        items={[
          item({
            configured: true,
            filamentId: '1',
            filamentLabel: 'PLA',
            filamentSlots: [
              { colourId: '10', colourLabel: 'Red', description: '', hex: '#ff0000' },
              { colourId: '10', colourLabel: 'Red', description: '', hex: '#ff0000' },
            ],
            gcodeDuration: 600,
            gcodePrice: 10,
            gcodeStatus: 'sliced',
            processId: '20',
            processLabel: 'Standard',
          }),
        ]}
      />,
    )

    fireEvent.click(screen.getAllByRole('button', { name: 'Change' })[1])
    fireEvent.click(screen.getByRole('button', { name: /Black/ }))
    expect(screen.getByText('Based on saved setup')).toBeTruthy()
  })

  it('confirms before discarding a dirty draft when switching models', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    render(
      <QuoteDetailsWorkspace
        {...props}
        items={[item(), item({ id: 'item-2', modelLabel: 'second.3mf' })]}
      />,
    )

    fireEvent.click(screen.getAllByRole('button', { name: 'Select' })[0])
    fireEvent.click(screen.getByRole('button', { name: /PLA/ }))
    fireEvent.click(screen.getByText('second.3mf'))
    expect(screen.getByRole('heading', { name: 'model.3mf' })).toBeTruthy()
    fireEvent.click(screen.getByText('second.3mf'))
    expect(screen.getByRole('heading', { name: 'second.3mf' })).toBeTruthy()
    expect(confirm).toHaveBeenCalledTimes(2)
  })

  it('resets slot and preview state when the active model is deleted', () => {
    const deleted = item({
      filamentSlots: [
        { colourId: '10', colourLabel: 'Red', description: '', hex: '#ff0000' },
        { colourId: '11', colourLabel: 'Black', description: '', hex: '#111111' },
        { colourId: '10', colourLabel: 'Red', description: '', hex: '#ff0000' },
      ],
      id: 'deleted-item',
      modelLabel: 'deleted.3mf',
      modelSlotCount: 3,
    })
    const remaining = item({
      filamentSlots: [{ colourId: '11', colourLabel: 'Black', description: '', hex: '#111111' }],
      id: 'remaining-item',
      modelLabel: 'remaining.3mf',
      modelSlotCount: 1,
    })
    const rendered = render(
      <QuoteDetailsWorkspace {...props} initialItemID={deleted.id} items={[deleted, remaining]} />,
    )

    expect(screen.getByTestId('model-preview').textContent).toBe('#ff0000,#111111,#ff0000')

    rendered.rerender(
      <QuoteDetailsWorkspace {...props} initialItemID={remaining.id} items={[remaining]} />,
    )

    expect(screen.getByRole('heading', { name: 'remaining.3mf' })).toBeTruthy()
    expect(screen.getByText('1 colour group')).toBeTruthy()
    expect(screen.getByTestId('model-preview').textContent).toBe('#111111')
  })
})

describe('shouldAutoRefreshQuote', () => {
  it('refreshes editable quotes while slicing', () => {
    expect(
      shouldAutoRefreshQuote({
        editable: true,
        hasFailedItems: false,
        hasInProgressItems: true,
        hasPendingPrices: true,
        quoteStatus: 'queued',
      }),
    ).toBe(true)
  })

  it('stops refreshing after a failure', () => {
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
