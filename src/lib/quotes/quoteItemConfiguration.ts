import type { Payload, PayloadRequest } from 'payload'

import type { Gcode, Quote } from '@/payload-types'
import { resolveRelationID } from '@/utilities/resolveRelationID'

export type QuoteItem = Quote['items'][number]

export type QuoteItemConfigurationIssueCode =
  | 'invalid-quantity'
  | 'missing-machine'
  | 'missing-material'
  | 'missing-model'
  | 'missing-process'
  | 'missing-slot-colour'
  | 'slot-count-mismatch'
  | 'unavailable-machine'
  | 'unavailable-material'
  | 'unavailable-process'
  | 'unavailable-slot-colour'

export type QuoteItemConfigurationIssue = {
  code: QuoteItemConfigurationIssueCode
  slotIndex?: number
}

export type SlicingConfiguration = {
  filament: number
  filamentSlots: { colour: number }[]
  machine: number
  model: number
  process: number
}

export type QuoteItemConfigurationAnalysis = {
  complete: boolean
  configuration: SlicingConfiguration | null
  configurationKey: string | null
  issues: QuoteItemConfigurationIssue[]
  slotColourIDs: Array<number | null>
  slotCount: number
}

type ConfigurationContext = {
  payload: Payload
  req?: PayloadRequest
}

const numericRelationID = (value: unknown): number | null => {
  const id = resolveRelationID(value)
  return typeof id === 'number' ? id : null
}

const getActive = async (
  { payload, req }: ConfigurationContext,
  collection: 'filaments' | 'machines' | 'processes',
  id: number | null,
) => {
  if (!id) return null

  try {
    return await payload.findByID({
      collection,
      id,
      depth: 0,
      ...(req ? { req } : {}),
      overrideAccess: true,
      select: { active: true },
    })
  } catch {
    return null
  }
}

const getModelSlotCount = async (
  { payload, req }: ConfigurationContext,
  modelID: number | null,
) => {
  if (!modelID) return { exists: false, slotCount: 1 }

  try {
    const model = await payload.findByID({
      collection: 'models',
      id: modelID,
      depth: 0,
      ...(req ? { req } : {}),
      overrideAccess: true,
      select: { filamentSlotCount: true },
    })
    return {
      exists: true,
      slotCount: Math.max(1, Math.floor(model.filamentSlotCount || 1)),
    }
  } catch {
    return { exists: false, slotCount: 1 }
  }
}

const getAvailableColourIDs = async (
  { payload, req }: ConfigurationContext,
  filamentID: number | null,
): Promise<Set<number>> => {
  if (!filamentID) return new Set()

  let result
  try {
    result = await payload.find({
      collection: 'spools',
      depth: 1,
      limit: 1000,
      pagination: false,
      ...(req ? { req } : {}),
      overrideAccess: true,
      sort: 'id',
      where: {
        and: [{ active: { equals: true } }, { material: { equals: filamentID } }],
      },
    })
  } catch {
    return new Set()
  }

  return new Set(
    result.docs.flatMap((spool) => {
      const material = typeof spool.material === 'object' ? spool.material : null
      const colour = typeof spool.colour === 'object' ? spool.colour : null
      return spool.active && material?.active && colour?.active ? [colour.id] : []
    }),
  )
}

export const getOrderedSlotColourIDs = (slots: unknown): Array<number | null> =>
  Array.isArray(slots) ? slots.map((slot) => numericRelationID(slot?.colour)) : []

export const getSlicingSelectionKey = (
  item: Pick<QuoteItem, 'filament' | 'filamentSlots' | 'machine' | 'model' | 'process'>,
): string =>
  JSON.stringify({
    model: numericRelationID(item.model),
    filament: numericRelationID(item.filament),
    filamentSlots: getOrderedSlotColourIDs(item.filamentSlots),
    process: numericRelationID(item.process),
    machine: numericRelationID(item.machine),
  })

export const getSlicingConfigurationKey = (configuration: SlicingConfiguration): string =>
  JSON.stringify({
    model: configuration.model,
    filament: configuration.filament,
    filamentSlots: configuration.filamentSlots.map((slot) => slot.colour),
    process: configuration.process,
    machine: configuration.machine,
  })

export const getGcodeConfiguration = (
  gcode: Pick<Gcode, 'filament' | 'filamentSlots' | 'machine' | 'model' | 'process'>,
): SlicingConfiguration | null => {
  const model = numericRelationID(gcode.model)
  const filament = numericRelationID(gcode.filament)
  const process = numericRelationID(gcode.process)
  const machine = numericRelationID(gcode.machine)
  const slotColourIDs = getOrderedSlotColourIDs(gcode.filamentSlots)

  if (!model || !filament || !process || !machine || slotColourIDs.some((id) => !id)) return null

  return {
    model,
    filament,
    process,
    machine,
    filamentSlots: slotColourIDs.map((colour) => ({ colour: colour as number })),
  }
}

export const gcodeMatchesConfiguration = (
  gcode: Pick<Gcode, 'filament' | 'filamentSlots' | 'machine' | 'model' | 'process'>,
  analysis: QuoteItemConfigurationAnalysis,
) => {
  const configuration = getGcodeConfiguration(gcode)
  return Boolean(
    configuration &&
    analysis.configurationKey &&
    getSlicingConfigurationKey(configuration) === analysis.configurationKey,
  )
}

export const analyzeQuoteItemConfiguration = async ({
  item,
  payload,
  req,
}: {
  item: QuoteItem
  payload: Payload
  req?: PayloadRequest
}): Promise<QuoteItemConfigurationAnalysis> => {
  const model = numericRelationID(item.model)
  const filament = numericRelationID(item.filament)
  const process = numericRelationID(item.process)
  const machine = numericRelationID(item.machine)
  const slotColourIDs = getOrderedSlotColourIDs(item.filamentSlots)
  const issues: QuoteItemConfigurationIssue[] = []

  if (!model) issues.push({ code: 'missing-model' })
  if (!filament) issues.push({ code: 'missing-material' })
  if (!process) issues.push({ code: 'missing-process' })
  if (!machine) issues.push({ code: 'missing-machine' })
  if (typeof item.quantity !== 'number' || item.quantity < 1) {
    issues.push({ code: 'invalid-quantity' })
  }

  const context = { payload, req }
  const [modelResult, materialDoc, processDoc, machineDoc, availableColourIDs] = await Promise.all([
    getModelSlotCount(context, model),
    getActive(context, 'filaments', filament),
    getActive(context, 'processes', process),
    getActive(context, 'machines', machine),
    getAvailableColourIDs(context, filament),
  ])

  if (model && !modelResult.exists) issues.push({ code: 'missing-model' })
  if (filament && !materialDoc?.active) issues.push({ code: 'unavailable-material' })
  if (process && !processDoc?.active) issues.push({ code: 'unavailable-process' })
  if (machine && !machineDoc?.active) issues.push({ code: 'unavailable-machine' })

  if (slotColourIDs.length !== modelResult.slotCount) {
    issues.push({ code: 'slot-count-mismatch' })
  }

  for (let slotIndex = 0; slotIndex < modelResult.slotCount; slotIndex++) {
    const colourID = slotColourIDs[slotIndex]
    if (!colourID) {
      issues.push({ code: 'missing-slot-colour', slotIndex })
    } else if (!availableColourIDs.has(colourID)) {
      issues.push({ code: 'unavailable-slot-colour', slotIndex })
    }
  }

  const complete = issues.length === 0
  const configuration: SlicingConfiguration | null = complete
    ? {
        model: model as number,
        filament: filament as number,
        process: process as number,
        machine: machine as number,
        filamentSlots: slotColourIDs.map((colour) => ({ colour: colour as number })),
      }
    : null

  return {
    complete,
    configuration,
    configurationKey: configuration ? getSlicingConfigurationKey(configuration) : null,
    issues,
    slotColourIDs,
    slotCount: modelResult.slotCount,
  }
}
