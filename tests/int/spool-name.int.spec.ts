import { describe, expect, it, vi } from 'vitest'

import { generateSpoolName } from '@/collections/Spools/hooks/generateSpoolName'

const relationNames = {
  colours: 'Galaxy Black',
  filaments: 'PLA',
  vendors: 'Polymaker',
} as const

const makeReq = () => {
  const findByID = vi.fn(({ collection }: { collection: keyof typeof relationNames }) =>
    Promise.resolve({ name: relationNames[collection] }),
  )

  return {
    findByID,
    req: {
      payload: {
        findByID,
      },
    } as never,
  }
}

describe('generateSpoolName', () => {
  it('preserves a supplied name', async () => {
    const { findByID, req } = makeReq()

    await expect(
      generateSpoolName({
        data: {
          colour: 2,
          material: 3,
          name: 'Custom spool name',
          vendor: 1,
        },
        operation: 'create',
        req,
      } as never),
    ).resolves.toMatchObject({ name: 'Custom spool name' })

    expect(findByID).not.toHaveBeenCalled()
  })

  it('generates a name from vendor, colour, and material when empty', async () => {
    const { findByID, req } = makeReq()

    await expect(
      generateSpoolName({
        data: {
          colour: 2,
          material: 3,
          name: '   ',
          vendor: 1,
        },
        operation: 'create',
        req,
      } as never),
    ).resolves.toMatchObject({ name: 'Polymaker Galaxy Black PLA' })

    expect(findByID).toHaveBeenCalledTimes(3)
  })

  it('preserves the existing name when it is omitted from an update', async () => {
    const { findByID, req } = makeReq()

    await expect(
      generateSpoolName({
        data: { active: false },
        operation: 'update',
        originalDoc: {
          colour: 2,
          material: 3,
          name: 'Existing spool name',
          vendor: 1,
        },
        req,
      } as never),
    ).resolves.toEqual({ active: false })

    expect(findByID).not.toHaveBeenCalled()
  })

  it('generates a name when an existing name is cleared on a partial update', async () => {
    const { req } = makeReq()

    await expect(
      generateSpoolName({
        data: { name: null },
        operation: 'update',
        originalDoc: {
          colour: 2,
          material: 3,
          name: 'Existing spool name',
          vendor: 1,
        },
        req,
      } as never),
    ).resolves.toMatchObject({ name: 'Polymaker Galaxy Black PLA' })
  })

  it('uses populated relationship names without querying them again', async () => {
    const { findByID, req } = makeReq()

    await expect(
      generateSpoolName({
        data: {
          colour: { id: 2, name: ' Galaxy Black ' },
          material: { id: 3, name: ' PLA ' },
          vendor: { id: 1, name: ' Polymaker ' },
        },
        operation: 'create',
        req,
      } as never),
    ).resolves.toMatchObject({ name: 'Polymaker Galaxy Black PLA' })

    expect(findByID).not.toHaveBeenCalled()
  })
})
