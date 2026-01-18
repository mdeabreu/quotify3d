import type { CollectionAfterChangeHook } from 'payload'

import { resolveRelationID } from '@/collections/Quotes/relations'
import type { Quote } from '@/payload-types'

type GcodeKey = {
  filament: number | string
  material: number | string
  model: number | string
  process: number | string
  machine: number | string
}

const buildKey = ({ filament, material, model, process, machine }: GcodeKey): string => {
  return [model, material, process, filament, machine].map(String).join(':')
}

export const createQuoteGcodes: CollectionAfterChangeHook = async ({
  doc,
  operation,
  req,
}) => {
  if (!doc || req.context?.skipCreateQuoteGcodes) {
    return doc
  }

  const quoteID = doc.id
  if (!quoteID || !Array.isArray(doc.items) || doc.items.length === 0) {
    return doc
  }

  const combinations = new Map<string, GcodeKey>()

  for (const item of doc.items) {
    if (!item) continue

    const model = resolveRelationID(item.model)
    const material = resolveRelationID(item.material)
    const process = resolveRelationID(item.process)
    const filament = resolveRelationID(item.filament)
    const machine = resolveRelationID(item.machine)

    if (!model || !material || !process || !filament || !machine) {
      continue
    }

    const key = buildKey({ filament, material, model, process, machine })
    combinations.set(key, { filament, material, model, process, machine })
  }

  if (combinations.size === 0) {
    return doc
  }

  const comboToGcodeID = new Map<string, number | string>()

  for (const [comboKey, combo] of combinations.entries()) {
    const modelId = Number(combo.model)
    const materialId = Number(combo.material)
    const processId = Number(combo.process)
    const filamentId = Number(combo.filament)
    const machineId = Number(combo.machine)

    if (
      [modelId, materialId, processId, filamentId, machineId].some(
        (value) => !Number.isFinite(value),
      )
    ) {
      continue
    }

    const existing = await req.payload.find({
      collection: 'gcodes',
      depth: 0,
      limit: 1,
      req,
      where: {
        and: [
          {
            quote: {
              equals: quoteID,
            },
          },
          {
            model: {
              equals: modelId,
            },
          },
          {
            material: {
              equals: materialId,
            },
          },
          {
            process: {
              equals: processId,
            },
          },
          {
            filament: {
              equals: filamentId,
            },
          },
          {
            machine: {
              equals: machineId,
            },
          },
        ],
      },
    })

    if (existing.docs.length > 0) {
      comboToGcodeID.set(comboKey, existing.docs[0].id)
      continue
    }

    const created = await req.payload.create({
      collection: 'gcodes',
      depth: 0,
      req,
      data: {
        status: 'queued',
        quote: quoteID,
        model: modelId,
        material: materialId,
        process: processId,
        filament: filamentId,
        machine: machineId,
      },
    })

    comboToGcodeID.set(comboKey, created.id)
  }

  if (comboToGcodeID.size === 0) {
    return doc
  }

  let itemsUpdated = false
  const updatedItems = doc.items.map((item: Quote['items'][number]) => {
    if (!item) return item

    const model = resolveRelationID(item.model)
    const material = resolveRelationID(item.material)
    const process = resolveRelationID(item.process)
    const filament = resolveRelationID(item.filament)
    const machine = resolveRelationID(item.machine)

    if (!model || !material || !process || !filament || !machine) {
      return item
    }

    const comboKey = buildKey({ filament, material, model, process, machine })
    const gcodeID = comboToGcodeID.get(comboKey)

    const currentGcodeID = resolveRelationID(item.gcode)
    if (!gcodeID || currentGcodeID === gcodeID) {
      return item
    }

    itemsUpdated = true
    return {
      ...item,
      gcode: gcodeID,
    }
  })

  if (!itemsUpdated) {
    return doc
  }

  await req.payload.update({
    collection: 'quotes',
    id: quoteID,
    data: {
      items: updatedItems,
    },
    depth: 0,
    req,
    context: {
      skipCreateQuoteGcodes: true,
    },
  })

  return {
    ...doc,
    items: updatedItems,
  }
}
