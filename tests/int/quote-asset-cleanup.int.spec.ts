import { describe, expect, it, vi } from 'vitest'

import {
  deleteQuoteGcodes,
  deleteQuoteModels,
} from '@/collections/Quotes/hooks/cleanupQuoteAssets'

describe('quote asset cleanup', () => {
  it('deletes every cached G-code before deleting a quote', async () => {
    const deleteRecord = vi.fn().mockResolvedValue({})
    const req = {
      payload: {
        delete: deleteRecord,
        find: vi.fn().mockResolvedValue({ docs: [{ id: 4 }, { id: 5 }] }),
        logger: { warn: vi.fn() },
      },
    }

    await deleteQuoteGcodes({ id: 7, req } as never)

    expect(deleteRecord).toHaveBeenCalledTimes(2)
    expect(deleteRecord).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'gcodes', id: 4 }),
    )
    expect(deleteRecord).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'gcodes', id: 5 }),
    )
  })

  it('logs G-code cleanup failures without blocking quote deletion', async () => {
    const warn = vi.fn()
    const req = {
      payload: {
        delete: vi.fn().mockRejectedValue(new Error('busy')),
        find: vi.fn().mockResolvedValue({ docs: [{ id: 4 }] }),
        logger: { warn },
      },
    }

    await expect(deleteQuoteGcodes({ id: 7, req } as never)).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalledOnce()
  })

  it('best-effort deletes each distinct unreferenced model after quote deletion', async () => {
    const deleteRecord = vi.fn().mockResolvedValue({})
    const req = {
      payload: {
        delete: deleteRecord,
        find: vi.fn().mockResolvedValue({ totalDocs: 0 }),
        logger: { warn: vi.fn() },
      },
    }

    await deleteQuoteModels({
      doc: {
        items: [{ model: 4 }, { model: 4 }, { model: 5 }],
      },
      req,
    } as never)

    expect(deleteRecord).toHaveBeenCalledTimes(2)
    expect(deleteRecord).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'models', id: 4 }),
    )
    expect(deleteRecord).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'models', id: 5 }),
    )
  })
})
