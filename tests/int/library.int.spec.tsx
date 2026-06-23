import { render, screen } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LibraryCardFrame } from '@/components/library/LibraryCardFrame'
import { ColourLibraryCard } from '@/components/library/LibraryCards'
import { LibraryPage } from '@/components/library/LibraryPage'
import {
  extractColourSwatches,
  fetchColourLibraryItems,
  fetchMaterialLibraryItems,
  fetchProcessLibraryItems,
} from '@/lib/library'

const find = vi.fn()
const activeSpoolResponse = {
  docs: [
    {
      active: true,
      id: 30,
      material: {
        active: true,
        description: 'Rigid and easy to print.',
        id: 1,
        image: null,
        name: 'PLA',
        pricePerGram: 0.18,
      },
      colour: {
        active: true,
        description: 'High-contrast dual tone.',
        finish: 'silk',
        id: 7,
        image: null,
        name: 'Sunset Shift',
        swatches: [{ hexcode: '#ff6600' }, { hexcode: '#3300ff' }],
        type: 'co-extrusion',
      },
    },
    {
      active: true,
      id: 31,
      material: {
        active: true,
        description: 'Duplicate material should collapse.',
        id: 1,
        image: null,
        name: 'PLA',
        pricePerGram: 0.18,
      },
      colour: {
        active: false,
        description: 'Unavailable colour.',
        finish: 'regular',
        id: 8,
        image: null,
        name: 'Hidden',
        swatches: [],
        type: 'solid',
      },
    },
  ],
}

const processExpectation = {
  collection: 'processes',
  expectedResult: [
    {
      description: 'Balanced speed and finish.',
      id: 3,
      image: null,
      name: 'Draft',
    },
  ],
  response: {
    docs: [{ description: 'Balanced speed and finish.', id: 3, image: null, name: 'Draft' }],
  },
  select: {
    description: true,
    image: true,
    name: true,
  },
} as const

vi.mock('@payload-config', () => ({
  default: {},
}))

vi.mock('payload', () => ({
  getPayload: vi.fn(async () => ({
    find,
  })),
}))

describe('library helpers', () => {
  beforeEach(() => {
    find.mockReset()
  })

  it('derives material library items from active spool combinations', async () => {
    find.mockResolvedValueOnce(activeSpoolResponse)

    await expect(fetchMaterialLibraryItems()).resolves.toEqual([
      {
        description: 'Rigid and easy to print.',
        id: 1,
        image: null,
        name: 'PLA',
        pricePerGram: 0.18,
      },
    ])
    expect(find).toHaveBeenCalledWith({
      collection: 'spools',
      depth: 2,
      limit: 200,
      overrideAccess: false,
      pagination: false,
      sort: 'id',
      where: {
        active: {
          equals: true,
        },
      },
    })
  })

  it('derives colour library items from active spool combinations', async () => {
    find.mockResolvedValueOnce(activeSpoolResponse)

    await expect(fetchColourLibraryItems()).resolves.toEqual([
      {
        description: 'High-contrast dual tone.',
        finish: 'silk',
        id: 7,
        image: null,
        name: 'Sunset Shift',
        swatches: ['#ff6600', '#3300ff'],
        type: 'co-extrusion',
      },
    ])
  })

  it('queries the processes collection directly through Payload', async () => {
    find.mockResolvedValueOnce(processExpectation.response)

    const result = await fetchProcessLibraryItems()

    expect(find).toHaveBeenCalledWith({
      collection: processExpectation.collection,
      depth: 1,
      limit: 200,
      overrideAccess: false,
      pagination: false,
      select: processExpectation.select,
      sort: 'name',
      where: {
        active: {
          equals: true,
        },
      },
    })
    expect(result).toEqual(processExpectation.expectedResult)
  })

  it('normalizes colour swatches from Payload records', () => {
    expect(
      extractColourSwatches([{ hexcode: ' #FFFFFF ' }, { hexcode: '#000000' }, { hexcode: '' }]),
    ).toEqual(['#FFFFFF', '#000000'])
  })
})

describe('library UI', () => {
  it('uses the library rendition when it is available', () => {
    render(
      <LibraryCardFrame
        description={null}
        image={{
          alt: 'PLA spool',
          createdAt: '2026-06-23T00:00:00.000Z',
          height: 1000,
          id: 1,
          sizes: {
            library: {
              height: 450,
              url: '/api/media/file/pla-600x450.jpg',
              width: 600,
            },
          },
          updatedAt: '2026-06-23T00:00:00.000Z',
          url: '/api/media/file/pla.jpg',
          width: 1500,
        }}
        title="PLA"
      />,
    )

    const image = screen.getByRole('img', { name: 'PLA spool' })
    expect(image.getAttribute('src')).toContain('pla-600x450.jpg')
    expect(image.getAttribute('width')).toBe('600')
    expect(image.getAttribute('height')).toBe('450')
  })

  it('falls back to the original image without a library rendition', () => {
    render(
      <LibraryCardFrame
        description={null}
        image={{
          alt: 'PETG spool',
          createdAt: '2026-06-23T00:00:00.000Z',
          height: 1000,
          id: 2,
          updatedAt: '2026-06-23T00:00:00.000Z',
          url: '/api/media/file/petg.jpg',
          width: 1500,
        }}
        title="PETG"
      />,
    )

    const image = screen.getByRole('img', { name: 'PETG spool' })
    expect(image.getAttribute('src')).toContain('petg.jpg')
    expect(image.getAttribute('width')).toBe('1500')
    expect(image.getAttribute('height')).toBe('1000')
  })

  it('renders an empty state when there are no items', () => {
    render(
      <LibraryPage
        description="Compare available options."
        emptyMessage="No entries yet."
        isEmpty
        title="Materials"
      >
        {[]}
      </LibraryPage>,
    )

    expect(screen.getByText('Materials')).toBeTruthy()
    expect(screen.getByText('Nothing published yet')).toBeTruthy()
    expect(screen.getByText('No entries yet.')).toBeTruthy()
  })

  it('renders colour metadata and swatches without requiring an image', () => {
    render(
      <ColourLibraryCard
        item={{
          description: 'High-contrast dual tone.',
          finish: 'silk',
          id: 7,
          image: null,
          name: 'Sunset Shift',
          swatches: ['#ff6600', '#3300ff'],
          type: 'co-extrusion',
        }}
      />,
    )

    expect(screen.getByText('Sunset Shift')).toBeTruthy()
    expect(screen.getByText('Silk')).toBeTruthy()
    expect(screen.getByText('Co Extrusion')).toBeTruthy()
    expect(screen.getByLabelText('#ff6600')).toBeTruthy()
    expect(screen.getByLabelText('#3300ff')).toBeTruthy()
  })
})
