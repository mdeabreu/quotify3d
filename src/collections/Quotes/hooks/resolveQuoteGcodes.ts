import type { CollectionBeforeChangeHook } from 'payload'

import { resolveRelationID } from '@/utilities/resolveRelationID'

export const resolveQuoteGcodes: CollectionBeforeChangeHook = async ({ data, req }) => {
  if (!data) return data

  if (!Array.isArray(data.items) || data.items.length === 0) {
    return data
  }

  for (let index = 0; index < data.items.length; index += 1) {
    const item = data.items[index]
    if (!item) continue

    const model = resolveRelationID(item.model)
    const filament = resolveRelationID(item.filament)
    const process = resolveRelationID(item.process)
    const machine = resolveRelationID(item.machine)

    let gcodeId = resolveRelationID(item.gcode)

    if (model && filament && process && machine) {
      const existing = await req.payload.find({
        collection: 'gcodes',
        depth: 0,
        limit: 1,
        req,
        overrideAccess: true,
        where: {
          and: [
            { model: { equals: model } },
            { filament: { equals: filament } },
            { process: { equals: process } },
            { machine: { equals: machine } },
          ],
        },
      })

      if (existing.docs.length > 0) {
        gcodeId = existing.docs[0].id
      } else {
        const created = await req.payload.create({
          collection: 'gcodes',
          depth: 0,
          req,
          overrideAccess: false,
          data: {
            status: 'queued',
            model,
            filament,
            process,
            machine,
          },
        })
        gcodeId = created.id
      }
    }

    data.items[index] = {
      ...item,
      gcode: gcodeId,
    }
  }

  return data
}
