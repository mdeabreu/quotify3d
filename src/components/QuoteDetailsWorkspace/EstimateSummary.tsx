import { AlertTriangleIcon, ClockIcon, WeightIcon } from 'lucide-react'

import { Label } from '@/components/ui/label'
import { cn } from '@/utilities/cn'
import { formatDuration, formatWeight } from '@/utilities/formatPrintMetrics'

import type { QuoteWorkspaceItem } from './types'

export const EstimateSummary = ({
  item,
  slicingDirty,
}: {
  item: QuoteWorkspaceItem
  slicingDirty: boolean
}) => (
  <div className={cn('min-h-20', slicingDirty && 'text-primary/45')}>
    <Label>Estimate</Label>
    <p
      aria-hidden={!slicingDirty}
      className={cn('mt-1 min-h-4 text-xs', !slicingDirty && 'invisible')}
    >
      Based on saved setup
    </p>
    <div className="mt-2 grid gap-2 text-sm">
      <span className="inline-flex h-5 min-w-0 items-center gap-2 whitespace-nowrap">
        <ClockIcon className="size-4 shrink-0" />
        {item.gcodeDuration !== null ? formatDuration(item.gcodeDuration) : 'Pending'}
      </span>
      <span className="inline-flex h-5 min-w-0 items-center gap-2 whitespace-nowrap">
        <WeightIcon className="size-4 shrink-0" />
        {item.gcodeWeight !== null ? formatWeight(item.gcodeWeight) : 'Pending'}
      </span>
    </div>
    {item.gcodeStatus === 'failed' ? (
      <p className="mt-2 inline-flex items-center gap-2 text-sm text-amber-700">
        <AlertTriangleIcon className="size-4" />
        We couldn&apos;t create an automatic estimate for this model. You can still submit it for
        manual pricing.
      </p>
    ) : null}
  </div>
)
