import type { QuoteStatus } from '@/payload-types'

const CUSTOMER_STATUS_LABELS: Record<QuoteStatus, string> = {
  approved: 'Approved',
  'in-review': 'In review',
  new: 'Draft',
  queued: 'Creating estimate',
  'ready-for-review': 'Submitted',
  rejected: 'Unable to quote',
  sliced: 'Estimate ready',
}

type EstimateItem = {
  gcodePrice?: number | null
  gcodeStatus?: string | null
  quantity?: number | null
}

export type QuoteEstimateDisplay = {
  amount: number | null
  label:
    | 'Estimate pending'
    | 'Estimated total'
    | 'Manual pricing required'
    | 'Partial estimate'
    | 'Total'
}

export const getCustomerQuoteStatusLabel = (status: QuoteStatus) => CUSTOMER_STATUS_LABELS[status]

export const getQuoteListActionLabel = (status: QuoteStatus) => {
  if (status === 'new' || status === 'queued' || status === 'sliced') return 'Continue quote'
  if (status === 'approved') return 'View quote'
  if (status === 'rejected') return 'View details'
  return 'View request'
}

export const getQuoteEstimateDisplay = ({
  items,
  status,
}: {
  items: EstimateItem[]
  status: QuoteStatus
}): QuoteEstimateDisplay => {
  const pricedItems = items.filter((item) => typeof item.gcodePrice === 'number')

  if (pricedItems.length === 0) {
    return {
      amount: null,
      label: items.some((item) => item.gcodeStatus === 'failed')
        ? 'Manual pricing required'
        : 'Estimate pending',
    }
  }

  const amount = pricedItems.reduce(
    (total, item) => total + (item.gcodePrice ?? 0) * Math.max(1, item.quantity ?? 1),
    0,
  )

  if (pricedItems.length < items.length) return { amount, label: 'Partial estimate' }
  return { amount, label: status === 'approved' ? 'Total' : 'Estimated total' }
}
