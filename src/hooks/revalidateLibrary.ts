import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

import { revalidatePath } from 'next/cache'

const revalidateLibraryPaths = (
  paths: readonly string[],
  req: Parameters<CollectionAfterChangeHook>[0]['req'],
) => {
  if (req.context.disableRevalidate) return

  for (const path of paths) {
    req.payload.logger.info(`Revalidating library page at path: ${path}`)
    revalidatePath(path)
  }
}

export const revalidateLibraryPage = (paths: readonly string[]): CollectionAfterChangeHook => {
  return ({ doc, req }) => {
    revalidateLibraryPaths(paths, req)
    return doc
  }
}

export const revalidateLibraryDelete = (paths: readonly string[]): CollectionAfterDeleteHook => {
  return ({ doc, req }) => {
    revalidateLibraryPaths(paths, req)
    return doc
  }
}
