import type { Metadata } from 'next'

import { resolveBranding, resolveOpenGraphDefaults } from './branding'
import { getCachedGlobal } from './getGlobals'
import { getServerSideURL } from './getURL'

export const getMergedOpenGraph = async (
  og?: Partial<Metadata['openGraph']>,
): Promise<Metadata['openGraph']> => {
  const settings = await getCachedGlobal('siteSettings', 1)()
  const defaults = resolveOpenGraphDefaults(settings)
  const images = og?.images ?? [{ url: defaults.image }]
  const baseURL = getServerSideURL()

  return {
    description: defaults.description,
    siteName: resolveBranding(settings).siteName,
    title: defaults.title,
    type: 'website',
    ...og,
    images: (Array.isArray(images) ? images : [images]).map((image) => {
      if (typeof image === 'string' || image instanceof URL) {
        return { url: new URL(image, baseURL).href }
      }

      return { ...image, url: new URL(image.url, baseURL).href }
    }),
  }
}
