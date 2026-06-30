import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { QuoteWizard } from '@/components/QuoteWizard'
import { MODEL_UPLOAD_ACCEPT } from '@/lib/modelUploadFormats'
import { buildAvailableSpoolOptions, getCatalogImageRendition } from '@/lib/spoolAvailability'

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
      finish: 'silk',
      id: 10,
      image: null,
      name: 'Red',
      swatches: [{ hexcode: '#ff0000' }, { hexcode: '#111111' }],
      type: 'co-extrusion',
    },
    id: 100,
    material: {
      active: true,
      description: 'Easy printing.',
      id: 1,
      image: {
        height: 1000,
        thumbnailURL: '/api/media/file/pla-thumbnail.jpg',
        sizes: {
          library: {
            height: 450,
            url: '/api/media/file/pla-library.jpg',
            width: 600,
          },
        },
        url: '/api/media/file/pla-original.jpg',
        width: 1500,
      },
      name: 'PLA',
      pricePerGram: 0.18,
    },
  },
]

let processDocs: unknown[] = []

describe('QuoteWizard options', () => {
  beforeEach(() => {
    push.mockReset()
    processDocs = []
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input)

        return Promise.resolve({
          ok: true,
          json: async () =>
            url.includes('/api/spools') ? { docs: spoolDocs } : { docs: processDocs },
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

  it('uses the library rendition on material cards when available', async () => {
    const { container } = render(<QuoteWizard />)

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(fileInput, {
      target: {
        files: [new File(['solid'], 'benchy.stl', { type: 'model/stl' })],
      },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    const image = await screen.findByRole('img', { name: 'PLA' })
    expect(image.getAttribute('src')).toContain('pla-library.jpg')
    expect(image.getAttribute('width')).toBe('600')
    expect(image.getAttribute('height')).toBe('450')
  })

  it('uses the library rendition on process cards when available', async () => {
    processDocs = [
      {
        active: true,
        description: 'Fast draft layers.',
        id: 20,
        image: {
          height: 900,
          thumbnailURL: '/api/media/file/draft-thumbnail.jpg',
          sizes: {
            library: {
              height: 450,
              url: '/api/media/file/draft-library.jpg',
              width: 600,
            },
          },
          url: '/api/media/file/draft-original.jpg',
          width: 1200,
        },
        name: 'Draft',
      },
    ]

    const { container } = render(<QuoteWizard />)

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(fileInput, {
      target: {
        files: [new File(['solid'], 'benchy.stl', { type: 'model/stl' })],
      },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    fireEvent.click(await screen.findByRole('button', { name: /PLA/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    fireEvent.click(screen.getByRole('button', { name: /Red/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    const image = await screen.findByRole('img', { name: 'Draft' })
    expect(image.getAttribute('src')).toContain('draft-library.jpg')
    expect(image.getAttribute('width')).toBe('600')
    expect(image.getAttribute('height')).toBe('450')
  })

  it('renders a colour preview from swatches when no colour image is available', async () => {
    const { container } = render(<QuoteWizard />)

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(fileInput, {
      target: {
        files: [new File(['solid'], 'benchy.stl', { type: 'model/stl' })],
      },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    fireEvent.click(await screen.findByRole('button', { name: /PLA/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    expect(screen.getByLabelText('Red colour preview')).toBeTruthy()
    expect(screen.queryByText('Preview unavailable')).toBeNull()
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

describe('catalog option image normalization', () => {
  it('prefers library renditions, then thumbnails, then originals', () => {
    const libraryRendition = getCatalogImageRendition({
      height: 1000,
      thumbnailURL: '/api/media/file/thumbnail.jpg',
      sizes: {
        library: {
          height: 450,
          url: '/api/media/file/library.jpg',
          width: 600,
        },
      },
      url: '/api/media/file/original.jpg',
      width: 1500,
    })
    expect(libraryRendition.imageUrl).toContain('/api/media/file/library.jpg')
    expect(libraryRendition.imageWidth).toBe(600)
    expect(libraryRendition.imageHeight).toBe(450)

    const thumbnailRendition = getCatalogImageRendition({
      height: 1000,
      thumbnailURL: '/api/media/file/thumbnail.jpg',
      url: '/api/media/file/original.jpg',
      width: 1500,
    })
    expect(thumbnailRendition.imageUrl).toContain('/api/media/file/thumbnail.jpg')
    expect(thumbnailRendition.imageWidth).toBeUndefined()
    expect(thumbnailRendition.imageHeight).toBeUndefined()

    const originalRendition = getCatalogImageRendition({
      height: 1000,
      thumbnailURL: null,
      url: '/api/media/file/original.jpg',
      width: 1500,
    })
    expect(originalRendition.imageUrl).toContain('/api/media/file/original.jpg')
    expect(originalRendition.imageWidth).toBe(1500)
    expect(originalRendition.imageHeight).toBe(1000)
  })

  it('uses the shared image preference for spool-derived options', () => {
    const [option] = buildAvailableSpoolOptions(
      spoolDocs as Parameters<typeof buildAvailableSpoolOptions>[0],
    )

    expect(option.filament.imageUrl).toContain('/api/media/file/pla-library.jpg')
    expect(option.filament.imageWidth).toBe(600)
    expect(option.filament.imageHeight).toBe(450)
    expect(option.colour.finish).toBe('silk')
    expect(option.colour.swatches).toEqual(['#ff0000', '#111111'])
    expect(option.colour.type).toBe('co-extrusion')
  })
})
