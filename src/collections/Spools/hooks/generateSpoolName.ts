import type { CollectionBeforeValidateHook, PayloadRequest } from 'payload'

import { resolveRelationID } from '@/utilities/resolveRelationID'

type NamedRelation = {
  id?: number | string
  name?: unknown
}

type NamedCollection = 'colours' | 'filaments' | 'vendors'

const getValue = (
  data: Record<string, unknown>,
  originalDoc: Record<string, unknown> | undefined,
  field: string,
) => (Object.prototype.hasOwnProperty.call(data, field) ? data[field] : originalDoc?.[field])

const getRelationName = async ({
  collection,
  req,
  value,
}: {
  collection: NamedCollection
  req: PayloadRequest
  value: unknown
}): Promise<string | undefined> => {
  if (value && typeof value === 'object') {
    const name = (value as NamedRelation).name
    if (typeof name === 'string' && name.trim()) {
      return name.trim()
    }
  }

  const id = resolveRelationID(value)
  if (id === undefined) return undefined

  const doc = await req.payload.findByID({
    collection,
    depth: 0,
    id,
    overrideAccess: false,
    req,
    select: {
      name: true,
    },
  })

  const name = (doc as { name?: unknown }).name

  return typeof name === 'string' && name.trim() ? name.trim() : undefined
}

export const generateSpoolName: CollectionBeforeValidateHook = async ({
  data,
  originalDoc,
  req,
}) => {
  if (!data) return data

  const incomingData = data as Record<string, unknown>
  const previousData = originalDoc as Record<string, unknown> | undefined
  const name = getValue(incomingData, previousData, 'name')

  if (typeof name === 'string' && name.trim()) {
    return data
  }

  const [vendorName, colourName, materialName] = await Promise.all([
    getRelationName({
      collection: 'vendors',
      req,
      value: getValue(incomingData, previousData, 'vendor'),
    }),
    getRelationName({
      collection: 'colours',
      req,
      value: getValue(incomingData, previousData, 'colour'),
    }),
    getRelationName({
      collection: 'filaments',
      req,
      value: getValue(incomingData, previousData, 'material'),
    }),
  ])

  if (!vendorName || !colourName || !materialName) {
    return data
  }

  return {
    ...data,
    name: `${vendorName} ${colourName} ${materialName}`,
  }
}
