'use client'

import { CheckIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { AvailableOption } from '@/lib/spoolAvailability'
import { cn } from '@/utilities/cn'

const OptionCard = ({
  fallback,
  onSelect,
  option,
  selected,
}: {
  fallback?: ReactNode
  onSelect: (option: AvailableOption) => void
  option: AvailableOption
  selected: boolean
}) => (
  <button
    className={cn(
      'min-w-0 rounded-md border bg-background p-3 text-left transition hover:border-primary/60',
      selected && 'border-primary bg-primary/5',
    )}
    onClick={() => onSelect(option)}
    type="button"
  >
    {option.imageUrl ? (
      // Library images can come from admin-configured storage providers.
      // eslint-disable-next-line @next/next/no-img-element
      <img alt="" className="h-24 w-full rounded-sm border object-cover" src={option.imageUrl} />
    ) : (
      fallback
    )}
    <div className="mt-2 flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="font-medium">{option.name}</p>
        {option.description ? (
          <p className="mt-1 line-clamp-2 text-sm text-primary/60">{option.description}</p>
        ) : null}
      </div>
      {selected ? <CheckIcon className="mt-0.5 size-4 shrink-0" /> : null}
    </div>
  </button>
)

export const OptionDialog = ({
  description,
  fallback,
  onSelect,
  open,
  options,
  selectedID,
  setOpen,
  title,
}: {
  description: string
  fallback?: (option: AvailableOption) => ReactNode
  onSelect: (option: AvailableOption) => void
  open: boolean
  options: AvailableOption[]
  selectedID: string
  setOpen: (open: boolean) => void
  title: string
}) => (
  <Dialog onOpenChange={setOpen} open={open}>
    <DialogContent className="sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <div className="grid max-h-[65vh] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3">
        {options.map((option) => (
          <OptionCard
            fallback={fallback?.(option)}
            key={option.id}
            onSelect={(selected) => {
              onSelect(selected)
              setOpen(false)
            }}
            option={option}
            selected={selectedID === String(option.id)}
          />
        ))}
      </div>
    </DialogContent>
  </Dialog>
)
