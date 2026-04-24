import { ProcessLibraryCard } from '@/components/library/LibraryCards'
import { LibraryPage } from '@/components/library/LibraryPage'
import { fetchProcessLibraryItems } from '@/lib/library'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'

export default async function ProcessesPage() {
  const processes = await fetchProcessLibraryItems()

  return (
    <LibraryPage
      description="Review the print process options we offer and compare the balance of speed, finish, and output quality for each workflow."
      emptyMessage="No processes are available to browse right now."
      isEmpty={processes.length === 0}
      title="Processes"
    >
      {processes.map((item) => (
        <ProcessLibraryCard item={item} key={item.id} />
      ))}
    </LibraryPage>
  )
}

export const metadata = {
  description: 'Browse available 3D print process options before requesting a quote.',
  openGraph: mergeOpenGraph({
    title: 'Processes',
    url: '/processes',
  }),
  title: 'Processes',
}
