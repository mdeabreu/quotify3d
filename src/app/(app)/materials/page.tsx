import { MaterialLibraryCard } from '@/components/library/LibraryCards'
import { LibraryPage } from '@/components/library/LibraryPage'
import { fetchMaterialLibraryItems } from '@/lib/library'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'

export default async function MaterialsPage() {
  const materials = await fetchMaterialLibraryItems()

  return (
    <LibraryPage
      description="Browse our supported print materials before you upload a model. Compare finishes, pricing, and the filament options we currently keep ready for production."
      emptyMessage="No materials are available to browse right now."
      isEmpty={materials.length === 0}
      title="Materials"
    >
      {materials.map((item) => (
        <MaterialLibraryCard item={item} key={item.id} />
      ))}
    </LibraryPage>
  )
}

export const metadata = {
  description: 'Browse available 3D printing materials and compare pricing before requesting a quote.',
  openGraph: mergeOpenGraph({
    title: 'Materials',
    url: '/materials',
  }),
  title: 'Materials',
}
