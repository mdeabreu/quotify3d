import type { CollectionConfig } from 'payload'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { info, revalidatePath } = vi.hoisted(() => ({
  info: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath }))

import { Colours } from '@/collections/Colours'
import { Filaments } from '@/collections/Filaments'
import { Processes } from '@/collections/Processes'
import { Spools } from '@/collections/Spools'

const hookArgs = (disableRevalidate = false) =>
  ({
    doc: { id: 1 },
    req: {
      context: { disableRevalidate },
      payload: { logger: { info } },
    },
  }) as never

const getHook = (
  collection: Pick<CollectionConfig, 'hooks' | 'slug'>,
  lifecycle: 'afterChange' | 'afterDelete',
) => {
  const hook = collection.hooks?.[lifecycle]?.[0]

  if (!hook) throw new Error(`Missing ${lifecycle} hook for ${collection.slug}`)

  return hook as (args: never) => unknown
}

describe('library page revalidation hooks', () => {
  beforeEach(() => {
    info.mockReset()
    revalidatePath.mockReset()
  })

  it.each([
    [Processes, '/processes'],
    [Filaments, '/materials'],
    [Colours, '/colours'],
  ] as const)('revalidates the mapped page on changes and deletes', async (collection, path) => {
    await getHook(collection, 'afterChange')(hookArgs())
    await getHook(collection, 'afterDelete')(hookArgs())

    expect(revalidatePath).toHaveBeenCalledTimes(2)
    expect(revalidatePath).toHaveBeenNthCalledWith(1, path)
    expect(revalidatePath).toHaveBeenNthCalledWith(2, path)
    expect(info).toHaveBeenCalledWith(`Revalidating library page at path: ${path}`)
  })

  it.each(['afterChange', 'afterDelete'] as const)(
    'revalidates both dependent pages when a spool is changed or deleted',
    async (lifecycle) => {
      await getHook(Spools, lifecycle)(hookArgs())

      expect(revalidatePath).toHaveBeenCalledTimes(2)
      expect(revalidatePath).toHaveBeenNthCalledWith(1, '/materials')
      expect(revalidatePath).toHaveBeenNthCalledWith(2, '/colours')
    },
  )

  it.each([
    [Processes, 'afterChange'],
    [Filaments, 'afterDelete'],
    [Colours, 'afterChange'],
    [Spools, 'afterDelete'],
  ] as const)('skips revalidation when disabled in the request context', async (collection, lifecycle) => {
    await getHook(collection, lifecycle)(hookArgs(true))

    expect(revalidatePath).not.toHaveBeenCalled()
    expect(info).not.toHaveBeenCalled()
  })
})
