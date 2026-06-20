import type { Product } from '@/payload-types'
import type { Where } from 'payload'

export const QUOTE_PRODUCT_PLACEHOLDER_SRC = '/images/quotify3d-quote-product-placeholder.png'

const quoteSourceFilter: Where = {
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
}

export const publicStorefrontProductsWhere = ({
  category,
  searchValue,
}: {
  category?: string | string[]
  searchValue?: string | string[]
} = {}): Where => {
  const categoryValue = Array.isArray(category) ? category[0] : category
  const searchQuery = Array.isArray(searchValue) ? searchValue[0] : searchValue

  const and: Where[] = [
    {
      _status: {
        equals: 'published',
      },
    },
    quoteSourceFilter,
  ]

  if (searchQuery) {
    and.push({
      or: [
        {
          title: {
            like: searchQuery,
          },
        },
        {
          description: {
            like: searchQuery,
          },
        },
      ],
    })
  }

  if (categoryValue) {
    and.push({
      categories: {
        contains: categoryValue,
      },
    })
  }

  return { and }
}

export const isPublicStorefrontProduct = (product: Product): boolean => !product.quote

export const getProductFallbackImage = (
  product: Partial<Product>,
  quoteProductPlaceholder = QUOTE_PRODUCT_PLACEHOLDER_SRC,
): string | null => {
  return product.quote ? quoteProductPlaceholder : null
}
