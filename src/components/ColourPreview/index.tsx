import type { Colour } from '@/payload-types'
import { cn } from '@/utilities/cn'
import type { CSSProperties } from 'react'

import styles from './styles.module.css'

export type ColourPreviewProps = {
  className?: string
  finish?: Colour['finish'] | null
  name: string
  swatches: string[]
  type?: Colour['type'] | null
}

type ColourOptionPreviewProps = {
  className?: string
  option: Pick<ColourPreviewProps, 'finish' | 'name' | 'swatches' | 'type'>
}

const uniqueSwatches = (swatches: string[]): string[] => {
  const unique = new Set<string>()

  for (const swatch of swatches) {
    const normalized = swatch.trim()
    if (normalized) unique.add(normalized)
  }

  return [...unique]
}

const getPreviewBackground = (swatches: string[], type: Colour['type'] | null | undefined) => {
  const [primary, secondary = primary, tertiary = secondary] = swatches

  if (type === 'gradient') {
    return `linear-gradient(135deg, ${swatches.join(', ')})`
  }

  if (type === 'co-extrusion') {
    return `linear-gradient(135deg, ${primary} 0 46%, ${secondary} 46% 54%, ${tertiary} 54% 100%)`
  }

  if (swatches.length > 1) {
    return `radial-gradient(circle at 82% 18%, ${secondary} 0 18%, transparent 19%), linear-gradient(135deg, ${primary}, ${primary})`
  }

  return primary
}

const getFinishClassName = (finish: Colour['finish'] | null | undefined): string => {
  if (finish === 'matte') return styles.matte
  if (finish === 'silk') return styles.silk

  return styles.regular
}

export const ColourPreview = ({
  className,
  finish = 'regular',
  name,
  swatches,
  type,
}: ColourPreviewProps) => {
  const colors = uniqueSwatches(swatches)

  if (colors.length === 0) return null

  const style: CSSProperties = {
    background: getPreviewBackground(colors, type),
  }

  return (
    <div
      aria-label={`${name} colour preview`}
      className={cn('relative isolate overflow-hidden rounded-sm border bg-background', className)}
      role="img"
      style={style}
    >
      <div aria-hidden className={getFinishClassName(finish)}>
        <span className={styles.lighting} />
        {finish === 'silk' ? (
          <>
            <span className={styles.silkBandPrimary} />
            <span className={styles.silkBandSecondary} />
            <span className={styles.silkBandTertiary} />
            <span className={styles.silkShine} />
          </>
        ) : null}
        <span className={styles.texture} />
        {finish === 'silk' ? null : <span className={styles.softHighlight} />}
      </div>
    </div>
  )
}

export const ColourOptionPreview = ({ className, option }: ColourOptionPreviewProps) => {
  if (option.swatches.length === 0) return null

  return (
    <ColourPreview
      className={className}
      finish={option.finish}
      name={option.name}
      swatches={option.swatches}
      type={option.type}
    />
  )
}
