'use client'

import { Price } from '@/components/Price'
import { cn } from '@/utilities/cn'

import { usesSameColour } from './draft'
import type { QuoteWorkspaceItem } from './types'

export const getQuoteItemState = (item: QuoteWorkspaceItem) => {
  if (!item.configured) return { label: 'Needs setup', tone: 'text-amber-700' }
  if (item.gcodeStatus === 'failed') return { label: 'Needs review', tone: 'text-red-600' }
  if (item.gcodeStatus === 'sliced') return { label: 'Estimated', tone: 'text-green-700' }
  return { label: 'Estimating', tone: 'text-primary/60' }
}

const selectedColourCount = (item: QuoteWorkspaceItem) =>
  usesSameColour(item) ? 1 : item.filamentSlots.filter((slot) => slot.colourId).length

export const QuoteItemList = ({
  activeItemID,
  currencyCode,
  items,
  onSelect,
}: {
  activeItemID: string
  currencyCode?: string
  items: QuoteWorkspaceItem[]
  onSelect: (itemID: string) => void
}) => (
  <div className="divide-y">
    {items.map((item) => {
      const state = getQuoteItemState(item)
      const colourCount = selectedColourCount(item)
      return (
        <button
          className={cn(
            'w-full px-4 py-4 text-left transition hover:bg-primary/5',
            activeItemID === item.id && 'bg-primary/5',
          )}
          key={item.id}
          onClick={() => onSelect(item.id)}
          type="button"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 truncate font-medium">{item.modelLabel}</p>
            <span className={cn('w-20 shrink-0 text-right text-xs', state.tone)}>
              {state.label}
            </span>
          </div>
          <p className="mt-2 truncate text-sm text-primary/55">
            {item.filamentLabel || 'Material'} ·{' '}
            {item.filamentSlots.some((slot) => slot.colourId)
              ? `${colourCount} colour${colourCount === 1 ? '' : 's'}`
              : `${item.modelSlotCount} colour slot${item.modelSlotCount === 1 ? '' : 's'}`}{' '}
            · {item.processLabel || 'Process'}
          </p>
          <div className="mt-3 flex items-end justify-between gap-3 text-sm">
            <span>Qty {item.quantity}</span>
            {item.configured && item.gcodePrice !== null ? (
              <Price amount={item.gcodePrice * item.quantity} currencyCode={currencyCode} />
            ) : (
              <span className="min-w-20 text-right text-primary/45">Pending</span>
            )}
          </div>
        </button>
      )
    })}
  </div>
)
