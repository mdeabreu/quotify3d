import type { Metadata } from 'next'
import type { Quote } from '@/payload-types'

import { Price } from '@/components/Price'
import { AddAllQuoteItemsToCartButton } from '@/components/QuoteActions/AddAllQuoteItemsToCartButton'
import { QuoteLineItem } from '@/components/QuoteLineItem'
import { QuoteStatus } from '@/components/QuoteStatus'
import { Button } from '@/components/ui/button'
import { formatDateTime } from '@/utilities/formatDateTime'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import { ChevronLeftIcon } from 'lucide-react'
import configPromise from '@payload-config'
import { headers as getHeaders } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ email?: string }>
}

export default async function QuotePage({ params, searchParams }: PageProps) {
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
      depth: 2,
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
        subtotal: true,
        currency: true,
        items: true,
        customerEmail: true,
        customer: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        notes: true,
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

  const quoteLineMatchers = quote.items.map((_, index) => `-q${quote.id}-i${index + 1}`)
  const relatedProductsResult =
    quoteLineMatchers.length > 0
      ? await payload.find({
          collection: 'products',
          depth: 0,
          limit: quote.items.length * 2,
          pagination: false,
          user,
          overrideAccess: false,
          where: {
            or: quoteLineMatchers.map((matcher) => ({
              slug: {
                like: matcher,
              },
            })),
          },
          select: {
            id: true,
            slug: true,
          },
        })
      : null

  const productByLineNumber = new Map<number, { id: number; slug?: string | null }>()

  if (relatedProductsResult?.docs?.length) {
    for (const product of relatedProductsResult.docs) {
      if (!product.slug) continue

      const lineMatch = product.slug.match(new RegExp(`-q${quote.id}-i(\\d+)(?:-\\d+)?$`))
      if (!lineMatch) continue

      const lineNumber = Number.parseInt(lineMatch[1] ?? '', 10)
      if (!Number.isFinite(lineNumber)) continue

      if (!productByLineNumber.has(lineNumber)) {
        productByLineNumber.set(lineNumber, { id: product.id, slug: product.slug })
      }
    }
  }

  const addableItems = quote.items.reduce<Array<{ productID: number; quantity: number }>>(
    (acc, item, index) => {
      const relatedProduct = productByLineNumber.get(index + 1)
      if (!relatedProduct) return acc

      acc.push({
        productID: relatedProduct.id,
        quantity: item.quantity,
      })

      return acc
    },
    [],
  )

  return (
    <div className="">
      <div className="flex gap-8 justify-between items-center mb-6">
        {user ? (
          <div className="flex gap-4">
            <Button asChild variant="ghost">
              <Link href="/quotes">
                <ChevronLeftIcon />
                All quotes
              </Link>
            </Button>
          </div>
        ) : (
          <div></div>
        )}

        <h1 className="text-sm uppercase font-mono px-2 bg-primary/10 rounded tracking-[0.07em]">
          <span className="">{`Quote #${quote.id}`}</span>
        </h1>
      </div>

      <div className="bg-card border rounded-lg px-6 py-4 flex flex-col gap-12">
        <div className="flex flex-col gap-6 lg:flex-row lg:justify-between">
          <div className="">
            <p className="font-mono uppercase text-primary/50 mb-1 text-sm">Quote Date</p>
            <p className="text-lg">
              <time dateTime={quote.createdAt}>
                {formatDateTime({ date: quote.createdAt, format: 'MMMM dd, yyyy' })}
              </time>
            </p>
          </div>

          <div className="">
            <p className="font-mono uppercase text-primary/50 mb-1 text-sm">Total</p>
            {typeof quote.subtotal === 'number' ? (
              <Price className="text-lg" amount={quote.subtotal} currencyCode={quote.currency ?? undefined} />
            ) : (
              <p className="text-primary/50">Pending</p>
            )}
          </div>

          {quote.status && (
            <div className="grow max-w-1/3">
              <p className="font-mono uppercase text-primary/50 mb-1 text-sm">Status</p>
              <QuoteStatus className="text-sm" status={quote.status} />
            </div>
          )}
        </div>

        {quote.items && (
          <div>
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="font-mono text-primary/50 uppercase text-sm">Items</h2>
              <AddAllQuoteItemsToCartButton items={addableItems} />
            </div>
            <ul className="flex flex-col gap-6">
              {quote.items.map((item, index) => (
                (() => {
                  const relatedProduct = productByLineNumber.get(index + 1)

                  return (
                    <li key={item.id ?? `${quote.id}-${index}`}>
                      <QuoteLineItem
                        item={item}
                        currencyCode={quote.currency ?? undefined}
                        productID={relatedProduct?.id}
                        productSlug={relatedProduct?.slug ?? undefined}
                      />
                    </li>
                  )
                })()
              ))}
            </ul>
          </div>
        )}

        {quote.notes ? (
          <div>
            <h2 className="font-mono text-primary/50 mb-4 uppercase text-sm">Notes</h2>
            <p className="whitespace-pre-wrap">{quote.notes}</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params

  return {
    description: `Quote details for quote ${id}.`,
    openGraph: mergeOpenGraph({
      title: `Quote ${id}`,
      url: `/quotes/${id}`,
    }),
    title: `Quote ${id}`,
  }
}
