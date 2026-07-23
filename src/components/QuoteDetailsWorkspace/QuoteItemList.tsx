'use client'

import { Price } from '@/components/Price'
import { cn } from '@/utilities/cn'
import { AlertTriangleIcon } from 'lucide-react'

import { usesSameColour } from './draft'
import type { QuoteWorkspaceItem } from './types'

export const getQuoteItemState = (item: QuoteWorkspaceItem) => {
  if (!item.configured) return { label: 'Setup needed', showWarning: true, tone: 'text-amber-700' }
  if (item.gcodeStatus === 'failed')
    return { label: 'Manual pricing', showWarning: false, tone: 'text-amber-700' }
  if (item.gcodeStatus === 'sliced') return { label: 'Estimate ready', tone: 'text-green-700' }
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
            <span
              className={cn(
                'inline-flex w-24 shrink-0 items-center justify-end gap-1 text-right text-xs',
                state.tone,
              )}
            >
              {'showWarning' in state && state.showWarning ? (
                <AlertTriangleIcon aria-hidden="true" className="size-3.5 shrink-0" />
              ) : null}
              {state.label}
            </span>
          </div>
          <p className="mt-2 truncate text-sm text-primary/55">
            {item.filamentLabel || 'Material'} ·{' '}
            {item.filamentSlots.some((slot) => slot.colourId)
              ? `${colourCount} colour${colourCount === 1 ? '' : 's'}`
              : `${item.modelSlotCount} colour group${item.modelSlotCount === 1 ? '' : 's'}`}{' '}
            · {item.processLabel || 'Print profile'}
          </p>
          <div className="mt-3 flex items-end justify-between gap-3 text-sm">
            <span>Qty {item.quantity}</span>
            {item.configured && item.gcodePrice !== null ? (
              <Price amount={item.gcodePrice * item.quantity} currencyCode={currencyCode} />
            ) : item.gcodeStatus === 'failed' ? (
              <span className="min-w-20 text-right text-amber-700">Manual pricing</span>
            ) : (
              <span className="min-w-20 text-right text-primary/45">Pending</span>
            )}
          </div>
        </button>
      )
    })}
  </div>
)
