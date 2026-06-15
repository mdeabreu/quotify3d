import { render, screen } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const globals = vi.hoisted(() => ({
  footer: {
    navItems: [],
  },
  siteSettings: {
    companyName: 'Example Prints',
    id: 1,
    logo: null,
    siteName: 'Example 3D',
  },
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

import { Footer } from '@/components/Footer'
import { resolveBranding } from '@/utilities/branding'

describe('branding', () => {
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

  it('falls back to environment branding when CMS values are absent', () => {
    process.env.COMPANY_NAME = 'Env Company'
    process.env.SITE_NAME = 'Env Site'

    expect(resolveBranding({ id: 1 })).toMatchObject({
      companyName: 'Env Company',
      logo: null,
      siteName: 'Env Site',
    })
  })

  it('renders fixed footer attribution links', async () => {
    render(await Footer())

    expect(screen.getByRole('link', { name: 'Quotify3d' }).getAttribute('href')).toBe(
      'https://github.com/mdeabreu/quotify3d',
    )
    expect(screen.getByRole('link', { name: 'Made with PayloadCMS' }).getAttribute('href')).toBe(
      'https://payloadcms.com',
    )
    expect(screen.getByText(/Example Prints/)).toBeTruthy()
  })
})
