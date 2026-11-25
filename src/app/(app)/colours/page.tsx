import type { Metadata } from 'next'

import { ColourLibraryFilter } from '@/components/library/ColourLibraryFilter'
import { LibraryPage } from '@/components/library/LibraryPage'
import { fetchColourLibraryItems } from '@/lib/library'
import { getMergedOpenGraph } from '@/utilities/mergeOpenGraph'
import { Suspense } from 'react'

export default async function ColoursPage() {
  const colours = await fetchColourLibraryItems()

  return (
    <LibraryPage
      description="Explore the colours and finishes we currently run in production. Use these references to narrow down the look you want before submitting a quote."
      emptyMessage="No colours are available to browse right now."
      isEmpty={colours.length === 0}
      renderGrid={false}
      title="Colours"
    >
      <Suspense fallback={null}>
        <ColourLibraryFilter colours={colours} />
      </Suspense>
    </LibraryPage>
  )
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    description: 'Browse 3D printing colours, finishes, and swatches before requesting a quote.',
    openGraph: await getMergedOpenGraph({
      title: 'Colours',
      url: '/colours',
    }),
    title: 'Colours',
  }
}
