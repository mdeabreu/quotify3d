import type { TaskHandler } from 'payload'

import { buildSlicerContext } from '@/jobs/workflows/helpers/gcodeHelpers'

export const buildSlicerContextTask: TaskHandler<'buildSlicerContextTask'> = async ({ input, req }) => {
  const gcodeId = input?.gcodeId
  if (!gcodeId) {
    throw new Error('buildSlicerContextTask: gcodeId is required')
  }

  const output = await buildSlicerContext({ req, gcodeId })
  return {
    output,
  }
}
