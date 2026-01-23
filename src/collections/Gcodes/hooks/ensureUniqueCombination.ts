import { APIError, type CollectionBeforeValidateHook } from 'payload'

import { resolveRelationID } from '@/utilities/resolveRelationID'

export const ensureUniqueCombination: CollectionBeforeValidateHook = async ({
  data,
  originalDoc,
  req,
}) => {
  if (!data) return data

  const model = resolveRelationID(data.model ?? originalDoc?.model)
  const filament = resolveRelationID(data.filament ?? originalDoc?.filament)
  const process = resolveRelationID(data.process ?? originalDoc?.process)
  const machine = resolveRelationID(data.machine ?? originalDoc?.machine)

  if (!model || !filament || !process || !machine) {
    return data
  }

  const currentId = resolveRelationID(originalDoc?.id)

  const existing = await req.payload.find({
    collection: 'gcodes',
    depth: 0,
    limit: 1,
    req,
    overrideAccess: true,
    where: {
      and: [
        currentId
          ? {
              id: {
                not_equals: currentId,
              },
            }
          : undefined,
        { model: { equals: model } },
        { filament: { equals: filament } },
        { process: { equals: process } },
        { machine: { equals: machine } },
      ].filter(Boolean),
    },
  })

  if (existing.docs.length > 0) {
    throw new APIError(
      'A G-code already exists for this model, filament, process, and machine.',
      500,
      {},
      true,
    )
  }

  return data
}
