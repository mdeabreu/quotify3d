import type { Metadata } from 'next'

import type { Page, Product } from '../payload-types'

import { resolveBranding } from './branding'
import { getServerSideURL } from './getURL'
import { getCachedGlobal } from './getGlobals'
import { getMergedOpenGraph } from './mergeOpenGraph'

export const generateMeta = async (args: { doc: Page | Product }): Promise<Metadata> => {
  const { doc } = args || {}
  const siteSettings = await getCachedGlobal('siteSettings', 1)()
  const branding = resolveBranding(siteSettings)
  const title = doc?.meta?.title || doc?.title || branding.siteName

  const ogImage =
    typeof doc?.meta?.image === 'object' &&
    doc.meta.image !== null &&
    'url' in doc.meta.image &&
    `${getServerSideURL()}${doc.meta.image.url}`

  return {
    description: doc?.meta?.description,
    openGraph: await getMergedOpenGraph({
      ...(doc?.meta?.description
        ? {
            description: doc?.meta?.description,
          }
        : {}),
      images: ogImage
        ? [
            {
              url: ogImage,
            },
          ]
        : undefined,
      siteName: branding.siteName,
      title,
      url: Array.isArray(doc?.slug) ? doc?.slug.join('/') : '/',
    }),
    title,
  }
}
