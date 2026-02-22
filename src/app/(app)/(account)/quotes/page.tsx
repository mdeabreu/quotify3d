import type { Quote } from '@/payload-types'
import type { Metadata } from 'next'

import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'

import { QuoteItem } from '@/components/QuoteItem'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { headers as getHeaders } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function Quotes() {
  const headers = await getHeaders()
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers })

  let quotes: Quote[] | null = null

  if (!user) {
    redirect(`/login?warning=${encodeURIComponent('Please login to access your quotes.')}`)
  }

  try {
    const quotesResult = await payload.find({
      collection: 'quotes',
      limit: 0,
      pagination: false,
      user,
      overrideAccess: false,
      where: {
        customer: {
          equals: user?.id,
        },
      },
    })

    quotes = quotesResult?.docs || []
  } catch (error) {}

  return (
    <>
      <div className="border p-8 rounded-lg bg-primary-foreground w-full">
        <h1 className="text-3xl font-medium mb-8">Quotes</h1>
        {(!quotes || !Array.isArray(quotes) || quotes?.length === 0) && (
          <p className="">You have no quotes.</p>
        )}

        {quotes && quotes.length > 0 && (
          <ul className="flex flex-col gap-6">
            {quotes?.map((quote) => (
              <li key={quote.id}>
                <QuoteItem quote={quote} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

export const metadata: Metadata = {
  description: 'Your quotes.',
  openGraph: mergeOpenGraph({
    title: 'Quotes',
    url: '/quotes',
  }),
  title: 'Quotes',
}
