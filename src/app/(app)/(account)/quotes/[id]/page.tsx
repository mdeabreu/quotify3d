import type { Metadata } from 'next'
import type { QuoteStatus } from '@/payload-types'

import { QuoteDetailsWorkspace } from '@/components/QuoteDetailsWorkspace'
import { Price } from '@/components/Price'
import { AddAllQuoteItemsToCartButton } from '@/components/QuoteActions/AddAllQuoteItemsToCartButton'
import { QuoteStatus as QuoteStatusBadge } from '@/components/QuoteStatus'
import { Button } from '@/components/ui/button'
import { formatDateTime } from '@/utilities/formatDateTime'
import { getVisibleAdminNotes } from '@/utilities/quotes/getVisibleAdminNotes'
import { getQuoteEstimateDisplay } from '@/utilities/quotes/presentation'
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
        title: 'Your quote request has been submitted.',
        body: 'We have everything we need and will review the files and pricing shortly. We’ll email you when your quote is approved.',
      }
    case 'in-review':
      return {
        title: 'We are reviewing your quote.',
        body: 'Our team is checking the files, printability, and pricing now. We’ll email you when your quote is approved.',
      }
    case 'approved':
      return {
        title: 'Your quote has been approved.',
        body: 'Review the approved items below, add them to your cart, and continue to checkout when you’re ready.',
      }
    case 'rejected':
      return {
        title: 'We’re unable to quote this request.',
        body: 'This request is closed and can’t be edited or resubmitted. Review our note below, or start a new quote with updated files or selections.',
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
    items: workspaceItems,
    materialOptions,
    qualityOptions,
    spoolOptions,
  } = await buildQuoteWorkspaceViewModel({ accessToken, email, payload, quote, user })
  const estimate = getQuoteEstimateDisplay({ items: workspaceItems, status: quote.status })

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
            <p className="mb-1 text-sm font-mono uppercase text-primary/50">Created</p>
            <p className="text-lg">
              <time dateTime={quote.createdAt}>
                {formatDateTime({ date: quote.createdAt, format: 'MMMM dd, yyyy' })}
              </time>
            </p>
          </div>

          <div>
            <p className="mb-1 text-sm font-mono uppercase text-primary/50">{estimate.label}</p>
            {estimate.amount !== null ? (
              <Price
                amount={estimate.amount}
                className="text-lg"
                currencyCode={quote.currency ?? undefined}
              />
            ) : (
              <p className="text-primary/50">No amount available yet</p>
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
                <p className="text-xs font-mono uppercase text-primary/50">
                  {quote.status === 'rejected'
                    ? 'Why we couldn’t quote this'
                    : 'A note from our team'}
                </p>
                <p className="mt-1 whitespace-pre-wrap">{visibleAdminNotes}</p>
              </div>
            ) : null}
            {quote.status === 'rejected' ? (
              <Button asChild className="mt-4" size="sm">
                <Link href="/quotes/new">Start a new quote</Link>
              </Button>
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
