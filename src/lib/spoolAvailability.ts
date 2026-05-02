import type { Colour, Filament, Media, Spool } from '@/payload-types'
import { resolveRelationID } from '@/utilities/resolveRelationID'

export type AvailableOption = {
  description: string | null
  id: number
  imageUrl: string | null
  name: string
}

export type AvailableSpoolOption = {
  colour: AvailableOption
  filament: AvailableOption
  id: number
}

type ActiveSpool = Spool & {
  active?: boolean | null
}

const toAbsoluteURL = (value: string): string => {
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value
  }

  const base = process.env.NEXT_PUBLIC_SERVER_URL ?? ''
  if (!base) return value

  return `${base}${value}`
}

const getImageUrl = (image: Media | number | null | undefined): string | null => {
  if (!image || typeof image === 'number') return null

  const candidate = image.thumbnailURL || image.url
  return typeof candidate === 'string' && candidate.length > 0 ? toAbsoluteURL(candidate) : null
}

const getActiveFilament = (value: Spool['material']): Filament | null => {
  if (!value || typeof value === 'number' || !value.active) return null
  return value
}

const getActiveColour = (value: Spool['colour']): Colour | null => {
  if (!value || typeof value === 'number' || !value.active) return null
  return value
}

const normalizeOption = (doc: Filament | Colour): AvailableOption => ({
  description: typeof doc.description === 'string' ? doc.description : null,
  id: doc.id,
  imageUrl: getImageUrl(doc.image),
  name: doc.name,
})

export const buildAvailableSpoolOptions = (spools: ActiveSpool[]): AvailableSpoolOption[] => {
  const canonicalByPair = new Map<string, AvailableSpoolOption>()

  for (const spool of [...spools].sort((left, right) => left.id - right.id)) {
    if (spool.active === false) continue

    const filament = getActiveFilament(spool.material)
    const colour = getActiveColour(spool.colour)
    if (!filament || !colour) continue

    const key = `${filament.id}:${colour.id}`
    if (canonicalByPair.has(key)) continue

    canonicalByPair.set(key, {
      colour: normalizeOption(colour),
      filament: normalizeOption(filament),
      id: spool.id,
    })
  }

  return [...canonicalByPair.values()].sort((left, right) => {
    const materialComparison = left.filament.name.localeCompare(right.filament.name)
    if (materialComparison !== 0) return materialComparison

    return left.colour.name.localeCompare(right.colour.name)
  })
}

export const getSpoolPairKey = ({
  colour,
  filament,
}: {
  colour: number
  filament: number
}): string => `${filament}:${colour}`

export const findSpoolForPair = (
  spools: AvailableSpoolOption[],
  {
    colour,
    filament,
  }: {
    colour: number | string
    filament: number | string
  },
): AvailableSpoolOption | undefined => {
  const filamentID = Number(filament)
  const colourID = Number(colour)

  if (!Number.isInteger(filamentID) || !Number.isInteger(colourID)) {
    return undefined
  }

  return spools.find((spool) => spool.filament.id === filamentID && spool.colour.id === colourID)
}

export const uniqueOptions = (
  spools: AvailableSpoolOption[],
  relation: 'colour' | 'filament',
): AvailableOption[] => {
  const byID = new Map<number, AvailableOption>()

  for (const spool of spools) {
    byID.set(spool[relation].id, spool[relation])
  }

  return [...byID.values()].sort((left, right) => left.name.localeCompare(right.name))
}

export const toNumericRelationID = (value: unknown): number | null => {
  const relationID = resolveRelationID(value)
  return typeof relationID === 'number' ? relationID : null
}
