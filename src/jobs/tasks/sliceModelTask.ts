import fs from 'fs/promises'
import type { TaskHandler } from 'payload'
import path from 'path'

import { sliceModel } from '@/jobs/workflows/helpers/gcodeHelpers'
import { resolveRelationID } from '@/utilities/resolveRelationID'

export const sliceModelTask: TaskHandler<'sliceModelTask'> = async ({ input, req }) => {
  const { gcodeId, filamentConfigPath, processConfigPath, machineConfigPath } = input || {}

  if (!gcodeId) {
    throw new Error('sliceModelTask: gcodeId is required')
  }

  if (!filamentConfigPath || !processConfigPath || !machineConfigPath) {
    throw new Error(
      'sliceModelTask: missing config paths; ensure buildSlicerContextTask ran successfully',
    )
  }

  const gcode = await req.payload.findByID({
    collection: 'gcodes',
    id: gcodeId,
    depth: 0,
  })

  const modelId = resolveRelationID(gcode.model)
  if (!modelId) {
    throw new Error('sliceModelTask: gcode is missing model reference')
  }

  const model = await req.payload.findByID({
    collection: 'models',
    id: modelId,
    depth: 0,
  })

  const filename = (model as { filename?: string }).filename
  if (!filename) {
    throw new Error('sliceModelTask: model is missing filename')
  }

  const modelPath = path.join(process.cwd(), 'data', 'models', filename)
  try {
    await fs.access(modelPath)
  } catch {
    throw new Error(`sliceModelTask: model file not found at ${modelPath}`)
  }

  const outputDir = path.join(process.cwd(), 'data', 'tmp', 'slicing', String(gcodeId), 'output')
  const { slicerOutput, gcodePaths, commandString } = await sliceModel({
    modelPath,
    outputDir,
    filamentConfigPath,
    processConfigPath,
    machineConfigPath,
  })

  return {
    output: {
      gcodePaths,
      slicerOutput,
      commandString,
    },
  }
}
