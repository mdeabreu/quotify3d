import type { Quote } from '@/payload-types'

import { Price } from '@/components/Price'
import { QuoteStatus } from '@/components/QuoteStatus'
import { Button } from '@/components/ui/button'
import configPromise from '@payload-config'
import { headers as getHeaders } from 'next/headers'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ email?: string }>
}

export default async function EditQuotePage({ params, searchParams }: PageProps) {
  const headers = await getHeaders()
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers })

  const { id } = await params
  const { email = '' } = await searchParams

  let quote: Quote | null = null

  try {
    const {
      docs: [quoteResult],
    } = await payload.find({
      collection: 'quotes',
      user,
      overrideAccess: !Boolean(user),
      depth: 1,
      where: {
        and: [
          {
            id: {
              equals: id,
            },
          },
          ...(user
            ? [
                {
                  customer: {
                    equals: user.id,
                  },
                },
              ]
            : []),
          ...(!user && email
            ? [
                {
                  customerEmail: {
                    equals: email,
                  },
                },
              ]
            : []),
        ],
      },
      select: {
        id: true,
        status: true,
        subtotal: true,
        currency: true,
        items: true,
        notes: true,
        customer: true,
        customerEmail: true,
      },
    })

    const canAccessAsGuest =
      !user &&
      email &&
      quoteResult &&
      quoteResult.customerEmail &&
      quoteResult.customerEmail === email

    const canAccessAsUser =
      user &&
      quoteResult &&
      quoteResult.customer &&
      (typeof quoteResult.customer === 'object' ? quoteResult.customer.id : quoteResult.customer) ===
        user.id

    if (quoteResult && (canAccessAsGuest || canAccessAsUser)) {
      quote = quoteResult
    }
  } catch (error) {
    console.error(error)
  }

  if (!quote) {
    notFound()
  }

  const updatePriceAction = async (formData: FormData) => {
    'use server'

    const payload = await getPayload({ config: configPromise })
    const headers = await getHeaders()
    const { user } = await payload.auth({ headers })

    const quoteID = Number.parseInt(String(formData.get('quoteID') ?? ''), 10)
    const customerEmail = String(formData.get('email') ?? '').trim().toLowerCase()

    if (!Number.isInteger(quoteID) || quoteID < 1) return

    if (user) {
      await payload.update({
        collection: 'quotes',
        id: quoteID,
        user,
        overrideAccess: false,
        data: {
          status: 'queued',
        },
      })
    } else if (customerEmail) {
      const guestQuoteResult = await payload.find({
        collection: 'quotes',
        depth: 0,
        limit: 1,
        pagination: false,
        overrideAccess: true,
        where: {
          and: [
            {
              id: {
                equals: quoteID,
              },
            },
            {
              customerEmail: {
                equals: customerEmail,
              },
            },
          ],
        },
      })

      const guestQuote = guestQuoteResult.docs[0]
      if (!guestQuote) return

      await payload.update({
        collection: 'quotes',
        id: guestQuote.id,
        overrideAccess: true,
        data: {
          status: 'queued',
        },
      })
    }

    redirect(`/quotes/${quoteID}/edit${customerEmail ? `?email=${encodeURIComponent(customerEmail)}` : ''}`)
  }

  const submitForReviewAction = async (formData: FormData) => {
    'use server'

    const payload = await getPayload({ config: configPromise })
    const headers = await getHeaders()
    const { user } = await payload.auth({ headers })

    const quoteID = Number.parseInt(String(formData.get('quoteID') ?? ''), 10)
    const customerEmail = String(formData.get('email') ?? '').trim().toLowerCase()

    if (!Number.isInteger(quoteID) || quoteID < 1) return

    if (user) {
      await payload.update({
        collection: 'quotes',
        id: quoteID,
        user,
        overrideAccess: false,
        data: {
          status: 'ready-for-review',
        },
      })
    } else if (customerEmail) {
      const guestQuoteResult = await payload.find({
        collection: 'quotes',
        depth: 0,
        limit: 1,
        pagination: false,
        overrideAccess: true,
        where: {
          and: [
            {
              id: {
                equals: quoteID,
              },
            },
            {
              customerEmail: {
                equals: customerEmail,
              },
            },
          ],
        },
      })

      const guestQuote = guestQuoteResult.docs[0]
      if (!guestQuote) return

      await payload.update({
        collection: 'quotes',
        id: guestQuote.id,
        overrideAccess: true,
        data: {
          status: 'ready-for-review',
        },
      })
    }

    redirect(`/quotes/${quoteID}/edit${customerEmail ? `?email=${encodeURIComponent(customerEmail)}` : ''}`)
  }

  return (
    <section className="border rounded-lg bg-card p-6 md:p-8 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-medium">Edit Quote #{quote.id}</h1>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href={`/quotes/${quote.id}${!user && email ? `?email=${encodeURIComponent(email)}` : ''}`}>
              View Details
            </Link>
          </Button>
          {user && (
            <Button asChild size="sm" variant="outline">
              <Link href="/quotes">All Quotes</Link>
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-8">
        <div>
          <p className="text-xs uppercase tracking-widest font-mono text-primary/50">Status</p>
          <QuoteStatus className="mt-1" status={quote.status} />
        </div>

        <div>
          <p className="text-xs uppercase tracking-widest font-mono text-primary/50">Estimated Total</p>
          {typeof quote.subtotal === 'number' ? (
            <Price amount={quote.subtotal} currencyCode={quote.currency ?? undefined} className="mt-1 text-lg" />
          ) : (
            <p className="mt-1 text-primary/70">Pending</p>
          )}
        </div>
      </div>

      <div className="rounded-md border bg-background px-4 py-3 text-sm text-primary/80">
        This page is currently a placeholder for full quote editing. You can queue a fresh pricing pass
        and submit the quote for staff review.
      </div>

      <div className="flex flex-wrap gap-3">
        <form action={updatePriceAction}>
          <input name="quoteID" type="hidden" value={quote.id} />
          {!user && <input name="email" type="hidden" value={email} />}
          <Button type="submit" variant="outline">
            Update Price
          </Button>
        </form>

        <form action={submitForReviewAction}>
          <input name="quoteID" type="hidden" value={quote.id} />
          {!user && <input name="email" type="hidden" value={email} />}
          <Button type="submit">Submit for Review</Button>
        </form>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm uppercase tracking-widest font-mono text-primary/50">Current Items</h2>
        <ul className="space-y-2">
          {quote.items.map((item, index) => {
            const modelLabel =
              typeof item.model === 'object' && item.model?.originalFilename
                ? item.model.originalFilename
                : `Model ${index + 1}`
            const filamentLabel =
              typeof item.filament === 'object' && item.filament?.name ? item.filament.name : 'Filament'
            const colourLabel =
              typeof item.colour === 'object' && item.colour?.name ? item.colour.name : 'Colour'
            const processLabel =
              typeof item.process === 'object' && item.process?.name ? item.process.name : 'Quality'

            return (
              <li className="rounded-md border bg-background px-4 py-3" key={item.id ?? `${quote.id}-${index}`}>
                <p className="font-medium">{modelLabel}</p>
                <p className="text-sm text-primary/70">
                  Qty {item.quantity} · {filamentLabel} · {colourLabel} · {processLabel}
                </p>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
