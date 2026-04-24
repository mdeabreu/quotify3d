import { render, screen } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ColourLibraryCard } from '@/components/library/LibraryCards'
import { LibraryPage } from '@/components/library/LibraryPage'
import {
  extractColourSwatches,
  fetchColourLibraryItems,
  fetchMaterialLibraryItems,
  fetchProcessLibraryItems,
} from '@/lib/library'

const find = vi.fn()
const payloadFindExpectations = [
  {
    collection: 'filaments',
    expectedResult: [
      {
        description: 'Rigid and easy to print.',
        id: 1,
        image: null,
        name: 'PLA',
        pricePerGram: 0.18,
      },
    ],
    fetchItems: fetchMaterialLibraryItems,
    response: {
      docs: [{ description: 'Rigid and easy to print.', id: 1, image: null, name: 'PLA', pricePerGram: 0.18 }],
    },
    select: {
      description: true,
      image: true,
      name: true,
      pricePerGram: true,
    },
  },
  {
    collection: 'colours',
    expectedResult: [
      {
        description: 'High-contrast dual tone.',
        finish: 'silk',
        id: 7,
        image: null,
        name: 'Sunset Shift',
        swatches: ['#ff6600', '#3300ff'],
        type: 'co-extrusion',
      },
    ],
    fetchItems: fetchColourLibraryItems,
    response: {
      docs: [
        {
          description: 'High-contrast dual tone.',
          finish: 'silk',
          id: 7,
          image: null,
          name: 'Sunset Shift',
          swatches: [{ hexcode: '#ff6600' }, { hexcode: '#3300ff' }],
          type: 'co-extrusion',
        },
      ],
    },
    select: {
      description: true,
      finish: true,
      image: true,
      name: true,
      swatches: {
        hexcode: true,
      },
      type: true,
    },
  },
  {
    collection: 'processes',
    expectedResult: [
      {
        description: 'Balanced speed and finish.',
        id: 3,
        image: null,
        name: 'Draft',
      },
    ],
    fetchItems: fetchProcessLibraryItems,
    response: {
      docs: [{ description: 'Balanced speed and finish.', id: 3, image: null, name: 'Draft' }],
    },
    select: {
      description: true,
      image: true,
      name: true,
    },
  },
] as const

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

  it.each(payloadFindExpectations)('queries the $collection collection directly through Payload', async ({
    collection,
    expectedResult,
    fetchItems,
    response,
    select,
  }) => {
    find.mockResolvedValueOnce(response)

    const result = await fetchItems()

    expect(find).toHaveBeenCalledWith({
      collection,
      depth: 1,
      limit: 200,
      overrideAccess: false,
      pagination: false,
      select,
      sort: 'name',
      where: {
        active: {
          equals: true,
        },
      },
    })
    expect(result).toEqual(expectedResult)
  })

  it('normalizes colour swatches from Payload records', () => {
    expect(
      extractColourSwatches([
        { hexcode: ' #FFFFFF ' },
        { hexcode: '#000000' },
        { hexcode: '' },
      ]),
    ).toEqual(['#FFFFFF', '#000000'])
  })
})

describe('library UI', () => {
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
