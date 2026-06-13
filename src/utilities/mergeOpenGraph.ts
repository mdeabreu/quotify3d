import type { Metadata } from 'next'

const defaultOpenGraph: Metadata['openGraph'] = {
  type: 'website',
  description:
    'Upload a 3D model, compare material and finish options, and request a print quote online.',
  images: [
    {
      url: 'https://payloadcms.com/images/og-image.jpg',
    },
  ],
  siteName: 'Quotify3D',
  title: 'Quotify3D',
}

export const mergeOpenGraph = (og?: Partial<Metadata['openGraph']>): Metadata['openGraph'] => {
  return {
    ...defaultOpenGraph,
    ...og,
    images: og?.images ? og.images : defaultOpenGraph.images,
  }
}
