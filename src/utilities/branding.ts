import type { Config, Media, SiteSetting } from '@/payload-types'

type BrandingGlobal = SiteSetting | Config['globals']['siteSettings'] | null | undefined

export const DEFAULT_BRANDING = {
  companyName: 'Quotify3D',
  logo: '/images/quotify3d-site-logo.png',
  openGraph: {
    description:
      'Upload a 3D model, compare material and finish options, and request a print quote online.',
    image: '/images/quotify3d-open-graph-default.png',
    title: 'Quotify3D',
  },
  quoteProductPlaceholder: '/images/quotify3d-quote-product-placeholder.png',
  siteName: 'Quotify3D',
} as const

const clean = (value: null | string | undefined) => {
  const trimmed = value?.trim()

  return trimmed || undefined
}

export const getDefaultBranding = () => {
  return {
    companyName: DEFAULT_BRANDING.companyName,
    logo: null as Media | null,
    siteName: DEFAULT_BRANDING.siteName,
  }
}

export const resolveBranding = (settings?: BrandingGlobal) => {
  const defaults = getDefaultBranding()
  const siteName = clean(settings?.siteName) || defaults.siteName
  const companyName = clean(settings?.companyName) || siteName
  const logo = typeof settings?.logo === 'object' && settings.logo ? settings.logo : null

  return {
    companyName,
    logo,
    siteName,
  }
}

export const resolveOpenGraphDefaults = (settings?: BrandingGlobal) => {
  const openGraph = settings?.defaultOpenGraph
  const image =
    typeof openGraph?.image === 'object' && openGraph.image?.url
      ? openGraph.image.url
      : DEFAULT_BRANDING.openGraph.image

  return {
    description: clean(openGraph?.description) || DEFAULT_BRANDING.openGraph.description,
    image,
    title: clean(openGraph?.title) || resolveBranding(settings).siteName,
  }
}
