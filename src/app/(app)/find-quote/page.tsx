import type { Metadata } from 'next'

import { FindQuoteForm } from '@/components/forms/FindQuoteForm'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import configPromise from '@payload-config'
import { headers as getHeaders } from 'next/headers.js'
import { getPayload } from 'payload'
import React from 'react'

export default async function FindQuotePage() {
  const headers = await getHeaders()
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers })

  return (
    <div className="container py-16">
      <FindQuoteForm initialEmail={user?.email} />
    </div>
  )
}

export const metadata: Metadata = {
  description: 'Find your quote with us using your email.',
  openGraph: mergeOpenGraph({
    title: 'Find quote',
    url: '/find-quote',
  }),
  title: 'Find quote',
}
