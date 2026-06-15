import type { Metadata } from 'next'

import { getDefaultBranding } from './branding'
import { getServerSideURL } from './getURL'

const defaultBranding = getDefaultBranding()

const defaultOpenGraph: Metadata['openGraph'] = {
  type: 'website',
  description:
    'Upload a 3D model, compare material and finish options, and request a print quote online.',
  images: [
    {
      url: `${getServerSideURL()}/images/thumbnail-placeholder.png`,
    },
  ],
  siteName: defaultBranding.siteName,
  title: defaultBranding.siteName,
}

export const mergeOpenGraph = (og?: Partial<Metadata['openGraph']>): Metadata['openGraph'] => {
  return {
    ...defaultOpenGraph,
    ...og,
    images: og?.images ? og.images : defaultOpenGraph.images,
  }
}
