import type { Colour, Filament, Media, Spool } from '@/payload-types'
import { resolveRelationID } from '@/utilities/resolveRelationID'

export type AvailableOption = {
  description: string | null
  imageHeight?: number | null
  id: number
  imageUrl: string | null
  imageWidth?: number | null
  name: string
  pricePerGram?: number | null
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

export type CatalogImage = Pick<Media, 'height' | 'sizes' | 'thumbnailURL' | 'url' | 'width'>

export const getCatalogImageRendition = (
  image: CatalogImage | number | null | undefined,
): Pick<AvailableOption, 'imageHeight' | 'imageUrl' | 'imageWidth'> => {
  if (!image || typeof image === 'number') {
    return {
      imageUrl: null,
    }
  }

  const library = image.sizes?.library
  const isUsingLibrary = Boolean(library?.url)
  const isUsingOriginal = !isUsingLibrary && !image.thumbnailURL && Boolean(image.url)
  const candidate = library?.url || image.thumbnailURL || image.url

  if (typeof candidate !== 'string' || candidate.length === 0) {
    return {
      imageUrl: null,
    }
  }

  const imageHeight = isUsingLibrary || isUsingOriginal ? (library?.height ?? image.height) : null
  const imageWidth = isUsingLibrary || isUsingOriginal ? (library?.width ?? image.width) : null

  return {
    ...(typeof imageHeight === 'number' ? { imageHeight } : {}),
    imageUrl: toAbsoluteURL(candidate),
    ...(typeof imageWidth === 'number' ? { imageWidth } : {}),
  }
}

const getActiveFilament = (value: Spool['material']): Filament | null => {
  if (!value || typeof value === 'number' || !value.active) return null
  return value
}

const getActiveColour = (value: Spool['colour']): Colour | null => {
  if (!value || typeof value === 'number' || !value.active) return null
  return value
}

const normalizeOption = (doc: Filament | Colour): AvailableOption => {
  const option: AvailableOption = {
    description: typeof doc.description === 'string' ? doc.description : null,
    ...getCatalogImageRendition(doc.image),
    id: doc.id,
    name: doc.name,
  }

  if ('pricePerGram' in doc) {
    option.pricePerGram = typeof doc.pricePerGram === 'number' ? doc.pricePerGram : null
  }

  return option
}

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
