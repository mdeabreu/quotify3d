import { cleanup, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Media, SiteSetting } from '@/payload-types'

const globals = vi.hoisted(() => ({
  footer: {
    navItems: [],
  },
  siteSettings: {
    companyName: 'Example Prints',
    id: 1,
    logo: null,
    siteName: 'Example 3D',
  } as SiteSetting,
}))

vi.mock('@/components/Footer/menu', () => ({
  FooterMenu: () => React.createElement('nav', null, 'Footer navigation'),
}))

vi.mock('@/providers/Theme/ThemeSelector', () => ({
  ThemeSelector: () => React.createElement('button', null, 'Theme'),
}))

vi.mock('@/utilities/getGlobals', () => ({
  getCachedGlobal: (slug: 'footer' | 'siteSettings') => async () => globals[slug],
}))

vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/quotes/workspaceActions', () => ({}))

import { generateMetadata as generateQuoteMetadata } from '@/app/(app)/(account)/quotes/[id]/page'
import { Footer } from '@/components/Footer'
import {
  DEFAULT_BRANDING,
  getOpenGraphImageURL,
  resolveBranding,
  resolveOpenGraphDefaults,
} from '@/utilities/branding'
import { getMergedOpenGraph } from '@/utilities/mergeOpenGraph'

describe('branding', () => {
  afterEach(() => {
    cleanup()
    delete globals.siteSettings.defaultOpenGraph
    vi.unstubAllEnvs()
  })

  beforeEach(() => {
    process.env.COMPANY_NAME = ''
    process.env.SITE_NAME = ''
  })

  it('resolves CMS branding before environment fallbacks', () => {
    process.env.COMPANY_NAME = 'Env Company'
    process.env.SITE_NAME = 'Env Site'

    expect(resolveBranding(globals.siteSettings)).toMatchObject({
      companyName: 'Example Prints',
      logo: null,
      siteName: 'Example 3D',
    })
  })

  it('falls back to Quotify3D branding when CMS values are absent', () => {
    process.env.COMPANY_NAME = 'Env Company'
    process.env.SITE_NAME = 'Env Site'

    expect(resolveBranding({ id: 1 })).toMatchObject({
      companyName: 'Quotify3D',
      logo: null,
      siteName: 'Quotify3D',
    })
  })

  it('resolves Open Graph values from Site Settings before bundled defaults', () => {
    const image = {
      id: 1,
      sizes: {
        og: {
          url: '/api/media/file/custom-1200x630.png',
        },
      },
      url: '/api/media/file/custom.png',
    } as Media

    expect(getOpenGraphImageURL(image)).toBe('/api/media/file/custom-1200x630.png')

    expect(
      resolveOpenGraphDefaults({
        defaultOpenGraph: {
          description: 'Custom description',
          image,
          title: 'Custom title',
        },
        id: 1,
      }),
    ).toMatchObject({
      description: 'Custom description',
      image: '/api/media/file/custom-1200x630.png',
      title: 'Custom title',
    })

    expect(resolveOpenGraphDefaults({ id: 1 })).toMatchObject(DEFAULT_BRANDING.openGraph)
  })

  it.each([
    ['/api/media/file/share.png', 'https://store.example.com/api/media/file/share.png'],
    ['https://cdn.example.com/share.png', 'https://cdn.example.com/share.png'],
  ])('uses the configured Open Graph image at %s for Quote details', async (url, expectedURL) => {
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://store.example.com')
    globals.siteSettings.defaultOpenGraph = {
      image: { id: 2, url } as Media,
    }

    const metadata = await generateQuoteMetadata({
      params: Promise.resolve({ id: '42' }),
      searchParams: Promise.resolve({}),
    })

    expect(metadata.openGraph).toMatchObject({
      images: [{ url: expectedURL }],
      title: 'Quote 42',
    })
  })

  it('uses the bundled Open Graph image when Site Settings has no image', async () => {
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://store.example.com')

    await expect(getMergedOpenGraph()).resolves.toMatchObject({
      images: [{ url: `https://store.example.com${DEFAULT_BRANDING.openGraph.image}` }],
    })
  })

  it('uses the page image before the Site Settings image and preserves its metadata', async () => {
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://store.example.com')
    globals.siteSettings.defaultOpenGraph = {
      image: { id: 2, url: '/api/media/file/share.png' } as Media,
    }
    const image = { alt: 'Product photo', url: '/api/media/file/product.png', width: 1200 }

    await expect(getMergedOpenGraph({ images: [image] })).resolves.toMatchObject({
      images: [{ ...image, url: 'https://store.example.com/api/media/file/product.png' }],
    })
  })

  it('renders fixed footer attribution links', async () => {
    render(await Footer())

    expect(screen.getByRole('link', { name: 'Quotify3D' }).getAttribute('href')).toBe(
      'https://github.com/mdeabreu/quotify3d',
    )
    expect(screen.getByRole('link', { name: 'Made with PayloadCMS' }).getAttribute('href')).toBe(
      'https://payloadcms.com',
    )
    expect(screen.getByText(/Example Prints/)).toBeTruthy()
  })
})
