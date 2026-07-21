import { describe, expect, it, vi } from 'vitest'

import {
  cleanupUploadedModels,
  deleteModelIfUnreferenced,
  uploadQuoteModels,
} from '@/lib/quotes/modelUploads'

const file = (name: string) =>
  ({
    arrayBuffer: async () => new TextEncoder().encode('model').buffer,
    name,
    size: 5,
    type: 'model/stl',
  }) as File

describe('quote model upload cleanup', () => {
  it('deletes every model created before a batch upload fails', async () => {
    const deleteRecord = vi.fn()
    const payload = {
      create: vi
        .fn()
        .mockResolvedValueOnce({ id: 1 })
        .mockResolvedValueOnce({ id: 2 })
        .mockRejectedValueOnce(new Error('upload failed')),
      delete: deleteRecord,
      logger: { warn: vi.fn() },
    }

    await expect(
      uploadQuoteModels({
        customerEmail: 'guest@example.com',
        files: [file('one.stl'), file('two.stl'), file('three.stl')],
        payload: payload as never,
        user: null,
      }),
    ).rejects.toThrow('upload failed')

    expect(deleteRecord).toHaveBeenCalledTimes(2)
    expect(deleteRecord).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'models', id: 1 }),
    )
    expect(deleteRecord).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'models', id: 2 }),
    )
  })

  it('supports cleanup after a later quote update fails', async () => {
    const deleteRecord = vi.fn()
    await cleanupUploadedModels(
      { delete: deleteRecord, logger: { warn: vi.fn() } } as never,
      [{ id: 1 }, { id: 2 }] as never,
    )
    expect(deleteRecord).toHaveBeenCalledTimes(2)
  })

  it('deletes an unreferenced removed model', async () => {
    const deleteRecord = vi.fn()
    const payload = {
      delete: deleteRecord,
      find: vi.fn().mockResolvedValue({ totalDocs: 0 }),
      logger: { warn: vi.fn() },
    }

    await expect(
      deleteModelIfUnreferenced({ modelID: 4, payload: payload as never }),
    ).resolves.toBe(true)
    expect(deleteRecord).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'models', id: 4 }),
    )
  })

  it('logs cleanup errors without failing the completed removal', async () => {
    const warn = vi.fn()
    const payload = {
      delete: vi.fn().mockRejectedValue(new Error('filesystem busy')),
      find: vi.fn().mockResolvedValue({ totalDocs: 0 }),
      logger: { warn },
    }

    await expect(
      deleteModelIfUnreferenced({ modelID: 4, payload: payload as never }),
    ).resolves.toBe(false)
    expect(warn).toHaveBeenCalledOnce()
  })
})
