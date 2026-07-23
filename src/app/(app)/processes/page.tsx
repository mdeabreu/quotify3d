import { ProcessLibraryCard } from '@/components/library/LibraryCards'
import { LibraryPage } from '@/components/library/LibraryPage'
import { fetchProcessLibraryItems } from '@/lib/library'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'

export default async function ProcessesPage() {
  const processes = await fetchProcessLibraryItems()

  return (
    <LibraryPage
      description="Compare print profiles for speed, finish, output quality, and strength before choosing one for your model."
      emptyMessage="No print profiles are available to browse right now."
      isEmpty={processes.length === 0}
      title="Print profiles"
    >
      {processes.map((item) => (
        <ProcessLibraryCard item={item} key={item.id} />
      ))}
    </LibraryPage>
  )
}

export const metadata = {
  description: 'Browse available 3D print profiles before requesting a quote.',
  openGraph: mergeOpenGraph({
    title: 'Print profiles',
    url: '/processes',
  }),
  title: 'Print profiles',
}
