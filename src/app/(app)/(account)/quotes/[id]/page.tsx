import type { Metadata } from 'next'
import type { QuoteStatus } from '@/payload-types'

import { QuoteDetailsWorkspace } from '@/components/QuoteDetailsWorkspace'
import { Price } from '@/components/Price'
import { AddAllQuoteItemsToCartButton } from '@/components/QuoteActions/AddAllQuoteItemsToCartButton'
import { QuoteStatus as QuoteStatusBadge } from '@/components/QuoteStatus'
import { Button } from '@/components/ui/button'
import { formatDateTime } from '@/utilities/formatDateTime'
import { getVisibleAdminNotes } from '@/utilities/quotes/getVisibleAdminNotes'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import { findAccessibleQuote } from '@/lib/quotes/findAccessibleQuote'
import {
  addQuoteModelsAction,
  removeQuoteItemAction,
  saveQuoteItemAction,
  submitQuoteForReviewAction,
} from '@/lib/quotes/workspaceActions'
import { isEditableQuoteStatus } from '@/lib/quotes/workspaceData'
import { buildQuoteWorkspaceViewModel } from '@/lib/quotes/workspaceViewModel'
import { ChevronLeftIcon } from 'lucide-react'
import configPromise from '@payload-config'
import { headers as getHeaders } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ email?: string; accessToken?: string; item?: string }>
}

const getReadOnlyQuoteMessage = (status: QuoteStatus) => {
  switch (status) {
    case 'ready-for-review':
      return {
        title: 'Your quote is waiting for review.',
        body: 'We have everything we need and will take a look shortly. Once reviewed, we will approve it or follow up if anything needs attention.',
      }
    case 'in-review':
      return {
        title: 'We are reviewing your quote.',
        body: 'Our team is checking the files and pricing now. We will update this quote as soon as the review is complete.',
      }
    case 'approved':
      return {
        title: 'Your quote has been approved.',
        body: 'Everything is ready on our side. You can review the items below and continue when you are ready.',
      }
    case 'rejected':
      return {
        title: 'This quote needs an update before it can move forward.',
        body: 'We were not able to approve this quote as submitted. Review the details below and contact us if you need help with the next step.',
      }
    default:
      return {
        title: 'This quote is currently read-only.',
        body: 'You can review the details below while we finish processing it.',
      }
  }
}

export default async function QuotePage({ params, searchParams }: PageProps) {
  const headers = await getHeaders()
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers })

  const { id } = await params
  const { email = '', accessToken = '', item: selectedItemID = '' } = await searchParams

  const quote = await findAccessibleQuote({
    accessToken,
    customerEmail: email,
    payload,
    quoteID: id,
    user,
  }).catch((error) => {
    console.error(error)
    return null
  })

  if (!quote) {
    notFound()
  }

  const editable = isEditableQuoteStatus(quote.status)
  const readOnlyMessage = !editable ? getReadOnlyQuoteMessage(quote.status) : null
  const visibleAdminNotes = getVisibleAdminNotes(quote)

  const {
    addableItems,
    hasPendingLineItemPrice,
    items: workspaceItems,
    materialOptions,
    qualityOptions,
    spoolOptions,
  } = await buildQuoteWorkspaceViewModel({ accessToken, email, payload, quote, user })

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-8">
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
          <div />
        )}

        <h1 className="rounded bg-primary/10 px-2 text-sm font-mono uppercase tracking-[0.07em]">
          <span>{`Quote #${quote.id}`}</span>
        </h1>
      </div>

      <div className="flex flex-col gap-10 rounded-lg border bg-card px-6 py-4">
        <div className="flex flex-col gap-6 lg:flex-row lg:justify-between">
          <div>
            <p className="mb-1 text-sm font-mono uppercase text-primary/50">Quote Date</p>
            <p className="text-lg">
              <time dateTime={quote.createdAt}>
                {formatDateTime({ date: quote.createdAt, format: 'MMMM dd, yyyy' })}
              </time>
            </p>
          </div>

          <div>
            <p
              className={
                hasPendingLineItemPrice
                  ? 'mb-1 text-sm font-mono uppercase text-primary/40'
                  : 'mb-1 text-sm font-mono uppercase text-primary/50'
              }
            >
              Total
            </p>
            {typeof quote.subtotal === 'number' ? (
              <Price
                amount={quote.subtotal}
                className={hasPendingLineItemPrice ? 'text-lg text-primary/55' : 'text-lg'}
                currencyCode={quote.currency ?? undefined}
              />
            ) : (
              <p className={hasPendingLineItemPrice ? 'text-primary/55' : 'text-primary/50'}>
                Pending
              </p>
            )}
          </div>

          {quote.status ? (
            <div className="grow max-w-1/3">
              <p className="mb-1 text-sm font-mono uppercase text-primary/50">Status</p>
              <QuoteStatusBadge className="text-sm" status={quote.status} />
            </div>
          ) : null}
        </div>

        {!editable ? (
          <div className="rounded-md border bg-background px-4 py-3 text-sm text-primary/70">
            <p className="font-medium text-primary">{readOnlyMessage?.title}</p>
            <p className="mt-1">{readOnlyMessage?.body}</p>
            {visibleAdminNotes ? (
              <div className="mt-3 border-l-2 border-primary/20 pl-3">
                <p className="text-xs font-mono uppercase text-primary/50">A note from our team</p>
                <p className="mt-1 whitespace-pre-wrap">{visibleAdminNotes}</p>
              </div>
            ) : null}
          </div>
        ) : null}

        <div>
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-sm font-mono uppercase text-primary/50">Items</h2>
            <AddAllQuoteItemsToCartButton items={addableItems} />
          </div>

          <QuoteDetailsWorkspace
            addModelsAction={addQuoteModelsAction}
            currencyCode={quote.currency ?? undefined}
            editable={editable}
            email={email}
            accessToken={accessToken}
            initialItemID={selectedItemID}
            items={workspaceItems}
            materialOptions={materialOptions}
            qualityOptions={qualityOptions}
            quoteID={quote.id}
            quoteNotes={quote.notes}
            quoteStatus={quote.status}
            removeItemAction={removeQuoteItemAction}
            saveItemAction={saveQuoteItemAction}
            submitForReviewAction={submitQuoteForReviewAction}
            spoolOptions={spoolOptions}
          />
        </div>

        {!editable && quote.notes ? (
          <div>
            <h2 className="mb-4 text-sm font-mono uppercase text-primary/50">Notes</h2>
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
