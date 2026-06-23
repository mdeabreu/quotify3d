import type { Metadata } from 'next'

import type { Page, Product } from '../payload-types'

import { getOpenGraphImageURL, resolveBranding } from './branding'
import { getServerSideURL } from './getURL'
import { getCachedGlobal } from './getGlobals'
import { getMergedOpenGraph } from './mergeOpenGraph'

export const generateMeta = async (args: { doc: Page | Product }): Promise<Metadata> => {
  const { doc } = args || {}
  const siteSettings = await getCachedGlobal('siteSettings', 1)()
  const branding = resolveBranding(siteSettings)
  const title = doc?.meta?.title || doc?.title || branding.siteName

  const ogImageURL =
    typeof doc?.meta?.image === 'object' &&
    doc.meta.image !== null &&
    getOpenGraphImageURL(doc.meta.image)
  const ogImage = ogImageURL ? `${getServerSideURL()}${ogImageURL}` : undefined

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
