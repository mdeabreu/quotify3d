import { APIError, type CollectionBeforeChangeHook } from 'payload'

import { resolveRelationID } from '@/utilities/resolveRelationID'

const TERMINAL_GCODE_STATUSES = new Set(['sliced', 'failed'])

export const ensureQuoteReadyForReview: CollectionBeforeChangeHook = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  if (!data || data.status !== 'ready-for-review') return data
  if (operation === 'update' && originalDoc?.status === 'ready-for-review') return data

  const items = Array.isArray(data.items)
    ? data.items
    : Array.isArray(originalDoc?.items)
      ? originalDoc.items
      : []

  const incompleteLines: number[] = []
  const unfinishedLines: number[] = []

  for (const [index, item] of items.entries()) {
    const lineNumber = index + 1
    const modelID = resolveRelationID(item?.model)
    const filamentID = resolveRelationID(item?.filament)
    const processID = resolveRelationID(item?.process)
    const machineID = resolveRelationID(item?.machine)
    const slots = Array.isArray(item?.filamentSlots) ? item.filamentSlots : []

    if (!modelID || !filamentID || !processID || !machineID || !item?.quantity || item.quantity < 1) {
      incompleteLines.push(lineNumber)
      continue
    }

    const model = await req.payload.findByID({
      collection: 'models',
      id: modelID,
      depth: 0,
      req,
      overrideAccess: true,
      select: { filamentSlotCount: true },
    })
    const slotCount = Math.max(1, Math.floor(model.filamentSlotCount || 1))
    const slotsComplete =
      slots.length === slotCount &&
      slots.every((slot: { colour?: unknown }) => Boolean(resolveRelationID(slot?.colour)))

    if (!slotsComplete) {
      incompleteLines.push(lineNumber)
      continue
    }

    const gcodeID = resolveRelationID(item?.gcode)
    if (!gcodeID) {
      unfinishedLines.push(lineNumber)
      continue
    }

    const gcode = await req.payload.findByID({
      collection: 'gcodes',
      id: gcodeID,
      depth: 0,
      req,
      overrideAccess: true,
      select: { status: true },
    })

    if (!TERMINAL_GCODE_STATUSES.has(gcode.status)) unfinishedLines.push(lineNumber)
  }

  if (incompleteLines.length > 0) {
    throw new APIError(
      `Complete every required selection before submitting. Incomplete line${incompleteLines.length === 1 ? '' : 's'}: ${incompleteLines.join(', ')}.`,
      400,
    )
  }

  if (unfinishedLines.length > 0) {
    throw new APIError(
      `Wait for the current estimate${unfinishedLines.length === 1 ? '' : 's'} to finish before submitting. Line${unfinishedLines.length === 1 ? '' : 's'}: ${unfinishedLines.join(', ')}.`,
      400,
    )
  }

  return data
}
