import { LibraryCardFrame } from '@/components/library/LibraryCardFrame'
import { Price } from '@/components/Price'
import type {
  ColourLibraryItem,
  MaterialLibraryItem,
  ProcessLibraryItem,
} from '@/lib/library'
import { capitaliseFirstLetter } from '@/utilities/capitaliseFirstLetter'

const humanizeValue = (value: string | null) => {
  if (!value) return null

  return value
    .split('-')
    .map(capitaliseFirstLetter)
    .join(' ')
}

export const MaterialLibraryCard = ({ item }: { item: MaterialLibraryItem }) => {
  return (
    <LibraryCardFrame
      description={item.description}
      image={item.image}
      title={item.name}
    >
      {typeof item.pricePerGram === 'number' ? (
        <div className="flex items-center justify-between rounded-lg border bg-background px-4 py-3">
          <span className="text-xs font-mono uppercase tracking-[0.24em] text-primary/55">
            Price / gram
          </span>
          <Price amount={item.pricePerGram} as="span" className="text-sm font-medium" />
        </div>
      ) : null}
    </LibraryCardFrame>
  )
}

export const ColourLibraryCard = ({ item }: { item: ColourLibraryItem }) => {
  const finish = humanizeValue(item.finish)
  const type = humanizeValue(item.type)

  return (
    <LibraryCardFrame
      description={item.description}
      image={item.image}
      title={item.name}
    >
      <div className="space-y-4">
        {(finish || type) && (
          <div className="flex flex-wrap gap-2">
            {finish ? (
              <span className="rounded-full border px-3 py-1 text-xs font-mono uppercase tracking-[0.18em] text-primary/60">
                {finish}
              </span>
            ) : null}
            {type ? (
              <span className="rounded-full border px-3 py-1 text-xs font-mono uppercase tracking-[0.18em] text-primary/60">
                {type}
              </span>
            ) : null}
          </div>
        )}

        {item.swatches.length ? (
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono uppercase tracking-[0.24em] text-primary/55">
              Swatches
            </span>
            <div className="flex flex-wrap gap-2">
              {item.swatches.map((swatch) => (
                <span
                  aria-label={swatch}
                  className="inline-flex h-6 w-6 rounded-full border shadow-sm"
                  key={swatch}
                  style={{ backgroundColor: swatch }}
                  title={swatch}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </LibraryCardFrame>
  )
}

export const ProcessLibraryCard = ({ item }: { item: ProcessLibraryItem }) => {
  return (
    <LibraryCardFrame
      description={item.description}
      image={item.image}
      title={item.name}
    />
  )
}
