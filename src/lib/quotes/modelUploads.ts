import type { Payload } from 'payload'

import type { Model, User } from '@/payload-types'

type UploadFile = {
  data: Buffer
  mimetype: string
  name: string
  size: number
}

const deleteModels = async (payload: Payload, modelIDs: number[]) => {
  await Promise.all(
    modelIDs.map(async (id) => {
      try {
        await payload.delete({ collection: 'models', id, overrideAccess: true })
      } catch (error) {
        payload.logger.warn({ err: error, modelID: id }, 'Could not clean up uploaded model')
      }
    }),
  )
}

export const uploadQuoteModels = async ({
  customerEmail,
  files,
  payload,
  user,
}: {
  customerEmail: string
  files: File[]
  payload: Payload
  user: User | null
}): Promise<Model[]> => {
  const created: Model[] = []

  try {
    for (const file of files) {
      const uploadFile: UploadFile = {
        name: file.name,
        data: Buffer.from(await file.arrayBuffer()),
        mimetype: file.type || 'application/octet-stream',
        size: file.size,
      }
      created.push(
        await payload.create({
          collection: 'models',
          file: uploadFile,
          user,
          overrideAccess: !Boolean(user),
          data: user ? {} : { customerEmail },
        }),
      )
    }

    return created
  } catch (error) {
    await deleteModels(
      payload,
      created.map((model) => model.id),
    )
    throw error
  }
}

export const cleanupUploadedModels = async (payload: Payload, models: Model[]) =>
  deleteModels(
    payload,
    models.map((model) => model.id),
  )

export const deleteModelIfUnreferenced = async ({
  modelID,
  payload,
}: {
  modelID: number
  payload: Payload
}) => {
  try {
    const [quotes, gcodes] = await Promise.all([
      payload.find({
        collection: 'quotes',
        depth: 0,
        limit: 1,
        overrideAccess: true,
        where: { 'items.model': { equals: modelID } },
      }),
      payload.find({
        collection: 'gcodes',
        depth: 0,
        limit: 1,
        overrideAccess: true,
        where: { model: { equals: modelID } },
      }),
    ])

    if (quotes.totalDocs > 0 || gcodes.totalDocs > 0) return false

    await payload.delete({ collection: 'models', id: modelID, overrideAccess: true })
    return true
  } catch (error) {
    payload.logger.warn({ err: error, modelID }, 'Could not delete unreferenced quote model')
    return false
  }
}
