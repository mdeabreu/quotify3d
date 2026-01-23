import type { TaskHandler } from 'payload'

import { parseGcodeOutputs } from '@/jobs/workflows/helpers/gcodeHelpers'

export const extractSlicerMetricsTask: TaskHandler<'extractSlicerMetricsTask'> = async ({
  input,
  req,
}) => {
  const gcodeId = input?.gcodeId
  const gcodePath = input?.gcodePath
  const plateIndex = input?.index

  if (!gcodeId) {
    throw new Error('extractSlicerMetricsTask: gcodeId is required')
  }

  if (!gcodePath) {
    throw new Error('extractSlicerMetricsTask: gcodePath is required')
  }

  const index = Number(plateIndex)
  if (!Number.isInteger(index) || index < 0) {
    throw new Error('extractSlicerMetricsTask: index must be a non-negative integer')
  }

  const { plates } = await parseGcodeOutputs([gcodePath])

  return {
    output: {
      filamentUsedGrams: plates[0]?.estimatedWeight ?? undefined,
      estimatedDuration: plates[0]?.estimatedDuration ?? undefined,
      gcode: plates[0]?.gcode ?? undefined,
    },
  }
}
