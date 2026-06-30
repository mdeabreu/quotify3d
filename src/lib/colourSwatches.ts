import type { Colour } from '@/payload-types'

export const extractColourSwatches = (
  swatches: Colour['swatches'] | null | undefined,
): string[] => {
  if (!Array.isArray(swatches)) return []

  return swatches
    .map((swatch) => (typeof swatch?.hexcode === 'string' ? swatch.hexcode.trim() : ''))
    .filter((swatch) => swatch.length > 0)
}
