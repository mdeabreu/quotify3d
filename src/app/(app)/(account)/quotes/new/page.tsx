import type { Metadata } from 'next'

import { QuoteWizard } from '@/components/QuoteWizard'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'

export default function NewQuotePage() {
  return <QuoteWizard />
}

export const metadata: Metadata = {
  description: 'Start a guided quote request for your 3D print.',
  openGraph: mergeOpenGraph({
    title: 'New Quote',
    url: '/quotes/new',
  }),
  title: 'New Quote',
}
