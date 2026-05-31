import { describe, expect, it } from 'vitest'

import { ProductsCollection } from '@/collections/Products'
import {
  QUOTE_PRODUCT_PLACEHOLDER_SRC,
  getProductFallbackImage,
  isPublicStorefrontProduct,
  publicStorefrontProductsWhere,
} from '@/utilities/products'
import type { Product } from '@/payload-types'

describe('product storefront visibility', () => {
  it('populates quote source data for relationship-rendered product cards', async () => {
    const collection = await ProductsCollection({
      defaultCollection: {
        slug: 'products',
        fields: [],
        defaultPopulate: {},
      },
    })

    expect(collection.defaultPopulate).toMatchObject({
      quote: true,
    })
  })

  it('filters public storefront queries to published products without a quote source', () => {
    expect(publicStorefrontProductsWhere()).toEqual({
      and: [
        {
          _status: {
            equals: 'published',
          },
        },
        {
          or: [
            {
              quote: {
                exists: false,
              },
            },
            {
              quote: {
                equals: null,
              },
            },
          ],
        },
      ],
    })
  })

  it('keeps quote-source filtering when storefront search and category filters are present', () => {
    expect(publicStorefrontProductsWhere({ category: 'materials', searchValue: 'pla' })).toEqual({
      and: [
        {
          _status: {
            equals: 'published',
          },
        },
        {
          or: [
            {
              quote: {
                exists: false,
              },
            },
            {
              quote: {
                equals: null,
              },
            },
          ],
        },
        {
          or: [
            {
              title: {
                like: 'pla',
              },
            },
            {
              description: {
                like: 'pla',
              },
            },
          ],
        },
        {
          categories: {
            contains: 'materials',
          },
        },
      ],
    })
  })

  it('treats products with a quote relationship as hidden from storefront discovery', () => {
    expect(isPublicStorefrontProduct({ id: 1, title: 'PLA spool' } as Product)).toBe(true)
    expect(isPublicStorefrontProduct({ id: 2, quote: 42, title: 'Custom print' } as Product)).toBe(
      false,
    )
  })

  it('uses the quote placeholder as the fallback image for quote-sourced products only', () => {
    expect(getProductFallbackImage({ id: 1, title: 'PLA spool' } as Product)).toBeNull()
    expect(getProductFallbackImage({ id: 2, quote: 42, title: 'Custom print' } as Product)).toBe(
      QUOTE_PRODUCT_PLACEHOLDER_SRC,
    )
  })
})
