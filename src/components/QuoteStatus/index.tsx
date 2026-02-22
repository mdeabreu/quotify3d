import { QuoteStatus as StatusOptions } from '@/payload-types'
import { cn } from '@/utilities/cn'

type Props = {
  status: StatusOptions
  className?: string
}

export const QuoteStatus: React.FC<Props> = ({ status, className }) => {
  return (
    <div
      className={cn(
        'text-xs tracking-widest font-mono uppercase py-0 px-2 rounded w-fit',
        className,
        {
          'bg-primary/10': status === 'new',
          'bg-warning/30': status === 'ready-for-review',
          'bg-warning': status === 'in-review',
          'bg-success': status === 'approved',
          'bg-error/30': status === 'rejected',
        },
      )}
    >
      {status}
    </div>
  )
}
