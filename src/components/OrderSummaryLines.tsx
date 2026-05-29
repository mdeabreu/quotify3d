import type { Order } from '@/payload-types'
import type React from 'react'

import { Price } from '@/components/Price'

type SummaryLine = NonNullable<NonNullable<Order['summary']>['lines']>[number]

type Props = {
  currencyCode?: string | null
  summary?: Order['summary']
}

const getLineKey = (line: SummaryLine, index: number): string =>
  line.id || `${line.type}-${line.label}-${index}`

export const OrderSummaryLines: React.FC<Props> = ({ currencyCode, summary }) => {
  const lines = summary?.lines?.filter((line) => typeof line.amount === 'number') || []

  if (lines.length === 0 && typeof summary?.total !== 'number') {
    return null
  }

  return (
    <div>
      <h2 className="font-mono text-primary/50 mb-4 uppercase text-sm">Order Summary</h2>
      <div className="flex flex-col gap-3">
        {lines.map((line, index) => (
          <div className="flex items-center justify-between gap-4" key={getLineKey(line, index)}>
            <span>{line.label}</span>
            <Price amount={line.amount} currencyCode={currencyCode ?? undefined} />
          </div>
        ))}

        {typeof summary?.total === 'number' && (
          <div className="flex items-center justify-between gap-4 border-t pt-3">
            <span className="uppercase">Total</span>
            <Price
              amount={summary.total}
              className="text-lg font-medium"
              currencyCode={currencyCode ?? undefined}
            />
          </div>
        )}
      </div>
    </div>
  )
}
