import type { Colour, Media, ProcessesSelect, Spool } from '@/payload-types'
import { extractColourSwatches } from '@/lib/colourSwatches'
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
  depth: 2,
  limit: 200,
  overrideAccess: false,
  pagination: false,
  sort: 'id',
  where: {
    active: {
      equals: true,
    },
  },
} as const

const processLibrarySelect = {
  description: true,
  image: true,
  name: true,
} satisfies ProcessesSelect

type ActiveSpool = Spool & {
  active?: boolean | null
}

const toMedia = (value: Media | number | null | undefined): Media | null => {
  if (!value || typeof value === 'number') return null
  return value
}

const getActiveSpoolDocs = async (): Promise<ActiveSpool[]> => {
  const payload = await getPayload({ config: configPromise })
  const { docs } = await payload.find({
    collection: 'spools',
    ...LIBRARY_QUERY,
  })

  return docs as ActiveSpool[]
}

const getActiveFilamentFromSpool = (spool: ActiveSpool) => {
  if (spool.active === false || typeof spool.material === 'number' || !spool.material.active) {
    return null
  }

  return spool.material
}

const getActiveColourFromSpool = (spool: ActiveSpool) => {
  if (spool.active === false || typeof spool.colour === 'number' || !spool.colour.active) {
    return null
  }

  return spool.colour
}

export const fetchMaterialLibraryItems = async (): Promise<MaterialLibraryItem[]> => {
  const spools = await getActiveSpoolDocs()
  const materialByID = new Map<number, NonNullable<ReturnType<typeof getActiveFilamentFromSpool>>>()

  for (const spool of spools) {
    const material = getActiveFilamentFromSpool(spool)
    if (!material || materialByID.has(material.id)) continue
    materialByID.set(material.id, material)
  }

  return [...materialByID.values()]
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((doc) => ({
      description: doc.description ?? null,
      id: doc.id,
      image: toMedia(doc.image),
      name: doc.name,
      pricePerGram: typeof doc.pricePerGram === 'number' ? doc.pricePerGram : null,
    }))
}

export const fetchColourLibraryItems = async (): Promise<ColourLibraryItem[]> => {
  const spools = await getActiveSpoolDocs()
  const colourByID = new Map<number, NonNullable<ReturnType<typeof getActiveColourFromSpool>>>()

  for (const spool of spools) {
    const colour = getActiveColourFromSpool(spool)
    if (!colour || colourByID.has(colour.id)) continue
    colourByID.set(colour.id, colour)
  }

  return [...colourByID.values()]
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((doc) => ({
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
    depth: 1,
    limit: LIBRARY_QUERY.limit,
    overrideAccess: LIBRARY_QUERY.overrideAccess,
    pagination: LIBRARY_QUERY.pagination,
    sort: 'name',
    where: LIBRARY_QUERY.where,
  })

  return docs.map((doc) => ({
    description: doc.description ?? null,
    id: doc.id,
    image: toMedia(doc.image),
    name: doc.name,
  }))
}
