import type {
  Colour,
  ColoursSelect,
  FilamentsSelect,
  Media,
  ProcessesSelect,
} from '@/payload-types'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

export type MaterialLibraryItem = {
  description: string | null
  id: number
  image: Media | null
  name: string
  pricePerGram: number | null
}

export type ColourLibraryItem = {
  description: string | null
  finish: Colour['finish'] | null
  id: number
  image: Media | null
  name: string
  swatches: string[]
  type: Colour['type'] | null
}

export type ProcessLibraryItem = {
  description: string | null
  id: number
  image: Media | null
  name: string
}

const LIBRARY_QUERY = {
  depth: 1,
  limit: 200,
  overrideAccess: false,
  pagination: false,
  sort: 'name',
  where: {
    active: {
      equals: true,
    },
  },
} as const

const materialLibrarySelect = {
  description: true,
  image: true,
  name: true,
  pricePerGram: true,
} satisfies FilamentsSelect

const colourLibrarySelect = {
  description: true,
  finish: true,
  image: true,
  name: true,
  swatches: {
    hexcode: true,
  },
  type: true,
} satisfies ColoursSelect

const processLibrarySelect = {
  description: true,
  image: true,
  name: true,
} satisfies ProcessesSelect

const toMedia = (value: Media | number | null | undefined): Media | null => {
  if (!value || typeof value === 'number') return null
  return value
}

export const extractColourSwatches = (
  swatches: Colour['swatches'] | null | undefined,
): string[] => {
  if (!Array.isArray(swatches)) return []

  return swatches
    .map((swatch) => (typeof swatch?.hexcode === 'string' ? swatch.hexcode.trim() : ''))
    .filter((swatch) => swatch.length > 0)
}

export const fetchMaterialLibraryItems = async (): Promise<MaterialLibraryItem[]> => {
  const payload = await getPayload({ config: configPromise })
  const { docs } = await payload.find({
    collection: 'filaments',
    select: materialLibrarySelect,
    ...LIBRARY_QUERY,
  })

  return docs.map((doc) => ({
    description: doc.description ?? null,
    id: doc.id,
    image: toMedia(doc.image),
    name: doc.name,
    pricePerGram: typeof doc.pricePerGram === 'number' ? doc.pricePerGram : null,
  }))
}

export const fetchColourLibraryItems = async (): Promise<ColourLibraryItem[]> => {
  const payload = await getPayload({ config: configPromise })
  const { docs } = await payload.find({
    collection: 'colours',
    select: colourLibrarySelect,
    ...LIBRARY_QUERY,
  })

  return docs.map((doc) => ({
    description: doc.description ?? null,
    finish: doc.finish ?? null,
    id: doc.id,
    image: toMedia(doc.image),
    name: doc.name,
    swatches: extractColourSwatches(doc.swatches),
    type: doc.type ?? null,
  }))
}

export const fetchProcessLibraryItems = async (): Promise<ProcessLibraryItem[]> => {
  const payload = await getPayload({ config: configPromise })
  const { docs } = await payload.find({
    collection: 'processes',
    select: processLibrarySelect,
    ...LIBRARY_QUERY,
  })

  return docs.map((doc) => ({
    description: doc.description ?? null,
    id: doc.id,
    image: toMedia(doc.image),
    name: doc.name,
  }))
}
