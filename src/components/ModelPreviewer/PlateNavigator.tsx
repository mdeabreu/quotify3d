'use client'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ChevronLeftIcon, ChevronRightIcon, RotateCcwIcon } from 'lucide-react'

import type { PreviewPlate } from './archive'

export const PlateNavigator = ({
  activeIndex,
  onReset,
  onSelect,
  plates,
}: {
  activeIndex: number
  onReset: () => void
  onSelect: (index: number) => void
  plates: PreviewPlate[]
}) => {
  const activePlate = plates[activeIndex]
  const hasMultiplePlates = plates.length > 1 && activePlate
  const position = hasMultiplePlates ? `Plate ${activeIndex + 1} of ${plates.length}` : ''

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 border-b bg-background p-2 sm:flex sm:items-center">
      {hasMultiplePlates ? (
        <>
          <p className="min-w-0 self-center truncate px-1 text-xs text-primary/60 sm:hidden">
            {position}
          </p>
          <div className="col-span-2 grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:order-1 sm:flex-1">
            <Button
              aria-label="Previous plate"
              disabled={activeIndex === 0}
              onClick={() => onSelect(activeIndex - 1)}
              size="icon"
              title="Previous plate"
              type="button"
              variant="outline"
            >
              <ChevronLeftIcon className="size-4" />
            </Button>

            <Select onValueChange={(value) => onSelect(Number(value))} value={String(activeIndex)}>
              <SelectTrigger
                aria-label={`Select preview plate. ${position}: ${activePlate.name}`}
                className="mb-0 h-9 min-w-0 w-full py-1 sm:h-auto"
                title={activePlate.name}
              >
                <SelectValue>
                  <span className="min-w-0 truncate sm:hidden">{activePlate.name}</span>
                  <span className="hidden min-w-0 flex-col items-start sm:flex">
                    <span className="text-xs text-primary/60">{position}</span>
                    <span className="w-full truncate text-left">{activePlate.name}</span>
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="w-72 max-w-[calc(100vw-2rem)]" position="item-aligned">
                {plates.map((plate, index) => (
                  <SelectItem
                    className="whitespace-normal"
                    key={`${plate.id}-${index}`}
                    value={String(index)}
                  >
                    {index + 1} — {plate.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              aria-label="Next plate"
              disabled={activeIndex === plates.length - 1}
              onClick={() => onSelect(activeIndex + 1)}
              size="icon"
              title="Next plate"
              type="button"
              variant="outline"
            >
              <ChevronRightIcon className="size-4" />
            </Button>
          </div>
        </>
      ) : null}

      <Button
        aria-label="Reset view"
        className="col-start-2 row-start-1 justify-self-end sm:order-2"
        onClick={onReset}
        size="icon"
        title="Reset view"
        type="button"
        variant="outline"
      >
        <RotateCcwIcon className="size-4" />
      </Button>
    </div>
  )
}
