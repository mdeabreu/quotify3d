import type { CollectionAfterChangeHook } from 'payload'

export const queueSliceWorkflow: CollectionAfterChangeHook = async ({
  doc,
  operation,
  previousDoc,
  req,
}) => {
  if (!doc) {
    return doc
  }

  const shouldQueue =
    operation === 'create' ||
    (operation === 'update' && doc.status === 'queued' && previousDoc?.status !== 'queued')
  if (!shouldQueue) {
    return doc
  }

  try {
    const job = await req.payload.jobs.queue({
      workflow: 'sliceGcode',
      input: {
        gcodeId: doc.id,
      },
      queue: 'slicing',
    })

    req.payload.jobs.runByID({ id: job.id })
  } catch (error) {
    req.payload.logger.error({ error }, 'Failed to queue slicing workflow')
  }

  return doc
}
