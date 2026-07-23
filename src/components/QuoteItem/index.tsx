import { QuoteStatus } from '@/components/QuoteStatus'
import { Price } from '@/components/Price'
import { Button } from '@/components/ui/button'
import { Quote } from '@/payload-types'
import { formatDateTime } from '@/utilities/formatDateTime'
import { getQuoteEstimateDisplay, getQuoteListActionLabel } from '@/utilities/quotes/presentation'
import Link from 'next/link'

type Props = {
  quote: Quote
}

export const QuoteItem: React.FC<Props> = ({ quote }) => {
  const itemsLabel = quote.items?.length === 1 ? 'Item' : 'Items'
  const estimate = getQuoteEstimateDisplay({ items: quote.items, status: quote.status })

  return (
    <div className="bg-card border rounded-lg px-4 py-2 md:px-6 md:py-4 flex flex-col sm:flex-row gap-12 sm:items-center sm:justify-between">
      <div className="flex flex-col gap-4">
        <h3 className="text-sm uppercase font-mono tracking-widest text-primary/50 truncate max-w-32 sm:max-w-none">{`#${quote.id}`}</h3>

        <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-6">
          <p className="text-xl">
            <time dateTime={quote.createdAt}>
              {formatDateTime({ date: quote.createdAt, format: 'MMMM dd, yyyy' })}
            </time>
          </p>

          {quote.status && <QuoteStatus status={quote.status} />}
        </div>

        <p className="flex gap-2 text-xs text-primary/80">
          <span>
            {quote.items?.length} {itemsLabel}
          </span>
          <>
            <span>•</span>
            {estimate.amount !== null ? (
              <span>
                {estimate.label}:{' '}
                <Price
                  as="span"
                  amount={estimate.amount}
                  currencyCode={quote.currency ?? undefined}
                />
              </span>
            ) : (
              <span>{estimate.label}</span>
            )}
          </>
        </p>
      </div>

      <Button variant="outline" asChild className="self-start sm:self-auto">
        <Link href={`/quotes/${quote.id}`}>{getQuoteListActionLabel(quote.status)}</Link>
      </Button>
    </div>
  )
}
