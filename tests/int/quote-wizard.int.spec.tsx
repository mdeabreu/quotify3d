import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { QuoteWizard } from '@/components/QuoteWizard'
import { MODEL_UPLOAD_ACCEPT } from '@/lib/modelUploadFormats'

const push = vi.fn()

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={typeof href === 'string' ? href : '#'} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push,
  }),
}))

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

vi.mock('@/providers/Auth', () => ({
  useAuth: () => ({
    user: {
      email: 'customer@example.com',
    },
  }),
}))

vi.mock('@payloadcms/plugin-ecommerce/client/react', () => ({
  useCurrency: () => ({
    formatCurrency: (amount: number) => `$${amount.toFixed(2)}`,
    supportedCurrencies: [{ code: 'USD' }],
  }),
}))

const spoolDocs = [
  {
    active: true,
    colour: {
      active: true,
      description: 'Bright red.',
      id: 10,
      image: null,
      name: 'Red',
    },
    id: 100,
    material: {
      active: true,
      description: 'Easy printing.',
      id: 1,
      image: null,
      name: 'PLA',
      pricePerGram: 0.18,
    },
  },
]

describe('QuoteWizard material pricing', () => {
  beforeEach(() => {
    push.mockReset()
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input)

        return Promise.resolve({
          ok: true,
          json: async () => (url.includes('/api/spools') ? { docs: spoolDocs } : { docs: [] }),
        })
      }),
    )
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('shows price per gram on material cards', async () => {
    const { container } = render(<QuoteWizard />)

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(fileInput, {
      target: {
        files: [new File(['solid'], 'benchy.stl', { type: 'model/stl' })],
      },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    expect(await screen.findByText('PLA')).toBeTruthy()
    expect(screen.getByText('$0.18')).toBeTruthy()
    expect(screen.getByText('/ gram')).toBeTruthy()
  })

  it('uses mobile-friendly model file accept hints', async () => {
    const { container } = render(<QuoteWizard />)

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    expect(fileInput.accept).toBe(MODEL_UPLOAD_ACCEPT)
    expect(fileInput.accept).toContain('.stl')
    expect(fileInput.accept).toContain('.3mf')
    expect(fileInput.accept).toContain('model/stl')
    expect(fileInput.accept).toContain('model/3mf')
    expect(fileInput.accept).toContain('application/vnd.ms-package.3dmanufacturing-3dmodel+xml')
  })

  it('rejects unsupported file extensions before upload', () => {
    const { container } = render(<QuoteWizard />)

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(fileInput, {
      target: {
        files: [new File(['not a model'], 'invoice.pdf', { type: 'application/octet-stream' })],
      },
    })

    expect(screen.getByText(/unsupported file format: invoice\.pdf/i)).toBeTruthy()
    expect(screen.queryByText('invoice.pdf')).toBeNull()
  })
})
