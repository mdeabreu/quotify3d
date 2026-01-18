import type { WorkflowHandler } from 'payload'

import { resolveRelationID } from '@/collections/Quotes/relations'

// Simple workflow that chains the stub tasks; will be expanded with real logic later.
export const sliceGcodeWorkflow: WorkflowHandler<'sliceGcode'> = async ({ req, job, tasks }) => {
  const gcodeId = job.input.gcodeId
  if (!gcodeId) {
    throw new Error('sliceGcode: gcodeId is required')
  }

  const gcode = await req.payload.findByID({
    collection: 'gcodes',
    id: gcodeId,
    depth: 0,
  })
  const quoteId = resolveRelationID(gcode.quote)
  if (!quoteId) {
    throw new Error('sliceGcode: gcode is missing quote reference')
  }

  const updateStatus = async (
    status: 'queued' | 'collecting-context' | 'slicing' | 'parsing' | 'completed' | 'failed',
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
      context: {
        skipQueueSliceWorkflow: true,
      },
    })
  }

  try {
    await updateStatus('collecting-context')

    const context = await tasks.collectSliceContext('collect-slice-context', {
      input: { gcodeId },
    })

    await updateStatus('slicing')

    const sliced = await tasks.runSlicer('run-slicer', {
      input: {
        gcodeId,
        ...context,
      },
    })

    await updateStatus('parsing')

    const gcodePaths: string[] = Array.isArray(sliced?.gcodePaths) ? sliced.gcodePaths : []

    if (gcodePaths.length === 0) {
      throw new Error('sliceGcode: runSlicer returned no gcode paths')
    }

    if (sliced?.slicerOutput) {
      await req.payload.update({
        collection: 'gcodes',
        id: gcodeId,
        data: {
          slicerOutput: sliced.slicerOutput,
        },
        depth: 0,
        context: {
          skipQueueSliceWorkflow: true,
        },
      })
    }

    for (const [index, gcodePath] of gcodePaths.entries()) {
      const taskId = `parse-gcode-${index}`
      await tasks.parseGcode(taskId, {
        input: {
          gcodeId,
          gcodePath,
          index,
        },
      })
    }

    await updateStatus('completed')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'sliceGcode: unknown error'

    try {
      await updateStatus('failed', message)
    } catch (statusError) {
      req.payload.logger.error({ error: statusError }, 'Failed to update gcode status after workflow error')
    }

    throw error
  }

  await req.payload.update({
    collection: 'quotes',
    id: quoteId,
    data: {},
    depth: 0,
    context: {
      skipCreateQuoteGcodes: true,
    },
  })
}
