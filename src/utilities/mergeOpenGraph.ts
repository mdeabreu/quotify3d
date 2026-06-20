import type { Metadata } from 'next'

import { DEFAULT_BRANDING, resolveBranding, resolveOpenGraphDefaults } from './branding'
import { getCachedGlobal } from './getGlobals'
import { getServerSideURL } from './getURL'

const defaultOpenGraph: Metadata['openGraph'] = {
  type: 'website',
  description: DEFAULT_BRANDING.openGraph.description,
  images: [
    {
      url: `${getServerSideURL()}${DEFAULT_BRANDING.openGraph.image}`,
    },
  ],
  siteName: DEFAULT_BRANDING.siteName,
  title: DEFAULT_BRANDING.siteName,
}

export const mergeOpenGraph = (og?: Partial<Metadata['openGraph']>): Metadata['openGraph'] => {
  return {
    ...defaultOpenGraph,
    ...og,
    images: og?.images ? og.images : defaultOpenGraph.images,
  }
}

export const getMergedOpenGraph = async (
  og?: Partial<Metadata['openGraph']>,
): Promise<Metadata['openGraph']> => {
  const settings = await getCachedGlobal('siteSettings', 1)()
  const defaults = resolveOpenGraphDefaults(settings)
  const configuredOpenGraph: Metadata['openGraph'] = {
    description: defaults.description,
    images: [{ url: `${getServerSideURL()}${defaults.image}` }],
    siteName: resolveBranding(settings).siteName,
    title: defaults.title,
    type: 'website',
  }

  return {
    ...configuredOpenGraph,
    ...og,
    images: og?.images ? og.images : configuredOpenGraph.images,
  }
}
