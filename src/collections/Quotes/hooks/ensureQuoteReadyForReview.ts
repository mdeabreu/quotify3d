import { APIError, type CollectionBeforeChangeHook } from 'payload'

import {
  analyzeQuoteItemConfiguration,
  gcodeMatchesConfiguration,
} from '@/lib/quotes/quoteItemConfiguration'
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
    const analysis = await analyzeQuoteItemConfiguration({ item, payload: req.payload, req })
    if (!analysis.complete) {
      incompleteLines.push(lineNumber)
      continue
    }

    const gcodeID = resolveRelationID(item?.gcode)
    if (!gcodeID) {
      unfinishedLines.push(lineNumber)
      continue
    }

    let gcode
    try {
      gcode = await req.payload.findByID({
        collection: 'gcodes',
        id: gcodeID,
        depth: 0,
        req,
        overrideAccess: true,
        select: {
          filament: true,
          filamentSlots: true,
          machine: true,
          model: true,
          process: true,
          status: true,
        },
      })
    } catch {
      unfinishedLines.push(lineNumber)
      continue
    }

    if (!gcodeMatchesConfiguration(gcode, analysis) || !TERMINAL_GCODE_STATUSES.has(gcode.status)) {
      unfinishedLines.push(lineNumber)
    }
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
