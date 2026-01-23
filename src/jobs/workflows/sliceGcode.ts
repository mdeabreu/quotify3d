import type { WorkflowHandler } from 'payload'

import {
  calculateGcodePrice,
  cleanSlicingWorkspace,
  resetGcodeSlicingResults,
  updateGcodeFromResults,
} from '@/jobs/workflows/helpers/gcodeHelpers'
import { resolveRelationID } from '@/utilities/resolveRelationID'

// Simple workflow that chains the stub tasks; will be expanded with real logic later.
export const sliceGcodeWorkflow: WorkflowHandler<'sliceGcode'> = async ({ req, job, tasks }) => {
  const gcodeId = job.input.gcodeId
  if (!gcodeId) {
    throw new Error('sliceGcode: gcodeId is required')
  }

  const updateStatus = async (
    status: 'queued' | 'collecting-context' | 'slicing' | 'parsing' | 'sliced' | 'failed',
    error?: string | null,
  ) => {
    await req.payload.update({
      collection: 'gcodes',
      id: gcodeId,
      data: {
        status,
        error: error ?? null,
      },
      depth: 0,
    })
  }

  try {
    await updateStatus('collecting-context')

    await cleanSlicingWorkspace(gcodeId)
    await resetGcodeSlicingResults({ req, gcodeId })

    const gcode = await req.payload.findByID({
      collection: 'gcodes',
      id: gcodeId,
      depth: 0,
    })

    const context = await tasks.buildSlicerContextTask('build-slicer-context', {
      input: { gcodeId },
    })

    await updateStatus('slicing')

    const sliced = await tasks.sliceModelTask('slice-model', {
      input: {
        gcodeId,
        ...context,
      },
    })

    await updateStatus('parsing')

    const gcodePaths: string[] = Array.isArray(sliced?.gcodePaths) ? sliced.gcodePaths : []

    if (gcodePaths.length === 0) {
      throw new Error('sliceGcode: sliceModelTask returned no gcode paths')
    }

    const plates: {
      estimatedWeight?: number | null
      estimatedDuration?: number | null
      gcode?: string | null
    }[] = []

    for (const [index, gcodePath] of gcodePaths.entries()) {
      const taskId = `extract-slicer-metrics-${index}`
      const parsed = await tasks.extractSlicerMetricsTask(taskId, {
        input: {
          gcodeId,
          gcodePath,
          index,
        },
      })

      plates.push({
        estimatedWeight: parsed?.filamentUsedGrams ?? undefined,
        estimatedDuration: parsed?.estimatedDuration ?? undefined,
        gcode: parsed?.gcode ?? undefined,
      })
    }

    const totalEstimatedWeight = plates.reduce<number>((total, plate) => {
      if (!plate || typeof plate.estimatedWeight !== 'number') {
        return total
      }
      return total + plate.estimatedWeight
    }, 0)

    const totalEstimatedDuration = plates.reduce<number>((total, plate) => {
      if (!plate || typeof plate.estimatedDuration !== 'number') {
        return total
      }
      return total + plate.estimatedDuration
    }, 0)

    const filamentId = resolveRelationID(gcode.filament)
    const machineId = resolveRelationID(gcode.machine)
    const weightOverride =
      typeof gcode.weightOverride === 'number' && gcode.weightOverride > 0
        ? gcode.weightOverride
        : undefined
    const durationOverride =
      typeof gcode.durationOverride === 'number' && gcode.durationOverride > 0
        ? gcode.durationOverride
        : undefined

    const estimatedPrice = await calculateGcodePrice({
      req,
      filamentId,
      machineId,
      totalEstimatedWeight,
      totalEstimatedDuration,
      weightOverride,
      durationOverride,
    })

    await updateGcodeFromResults({
      req,
      gcodeId,
      slicingCommand: sliced?.commandString,
      slicerOutput: sliced?.slicerOutput,
      plates,
      totalEstimatedWeight,
      totalEstimatedDuration,
      estimatedPrice,
    })

    await updateStatus('sliced')

    const quotes = await req.payload.find({
      collection: 'quotes',
      depth: 0,
      limit: 100,
      overrideAccess: true,
      where: {
        'items.gcode': {
          equals: gcodeId,
        },
      },
    })

    for (const quote of quotes.docs) {
      await req.payload.update({
        collection: 'quotes',
        id: quote.id,
        data: {},
        depth: 0,
        overrideAccess: true,
      })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'sliceGcode: unknown error'

    try {
      await updateStatus('failed', message)
    } catch (statusError) {
      req.payload.logger.error(
        { error: statusError },
        'Failed to update gcode status after workflow error',
      )
    }

    throw error
  }
}
