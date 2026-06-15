import type { Config, Media, SiteSetting } from '@/payload-types'

type BrandingGlobal = SiteSetting | Config['globals']['siteSettings'] | null | undefined

const defaultSiteName = 'Quotify3D'

const clean = (value: null | string | undefined) => {
  const trimmed = value?.trim()

  return trimmed || undefined
}

export const getDefaultBranding = () => {
  const siteName = clean(process.env.SITE_NAME) || defaultSiteName
  const companyName = clean(process.env.COMPANY_NAME) || siteName

  return {
    companyName,
    logo: null as Media | null,
    siteName,
  }
}

export const resolveBranding = (settings?: BrandingGlobal) => {
  const defaults = getDefaultBranding()
  const siteName = clean(settings?.siteName) || defaults.siteName
  const companyName = clean(settings?.companyName) || clean(process.env.COMPANY_NAME) || siteName
  const logo = typeof settings?.logo === 'object' && settings.logo ? settings.logo : null

  return {
    companyName,
    logo,
    siteName,
  }
}
