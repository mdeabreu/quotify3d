import type { Product, ArchiveBlock as ArchiveBlockProps } from '@/payload-types'

import configPromise from '@payload-config'
import { DefaultDocumentIDType, getPayload } from 'payload'
import React from 'react'
import { RichText } from '@/components/RichText'
import { isPublicStorefrontProduct, publicStorefrontProductsWhere } from '@/utilities/products'

import { CollectionArchive } from '@/components/CollectionArchive'

export const ArchiveBlock: React.FC<
  ArchiveBlockProps & {
    id?: DefaultDocumentIDType
    className?: string
  }
> = async (props) => {
  const { id, categories, introContent, limit: limitFromProps, populateBy, selectedDocs } = props

  const limit = limitFromProps || 3

  let posts: Product[] = []

  if (populateBy === 'collection') {
    const payload = await getPayload({ config: configPromise })

    const flattenedCategories = categories?.map((category) => {
      if (typeof category === 'object') return category.id
      else return category
    })

    const fetchedProducts = await payload.find({
      collection: 'products',
      depth: 1,
      limit,
      where: {
        and: [
          publicStorefrontProductsWhere(),
          ...(flattenedCategories && flattenedCategories.length > 0
            ? [
                {
                  categories: {
                    in: flattenedCategories,
                  },
                },
              ]
            : []),
        ],
      },
    })

    posts = fetchedProducts.docs
  } else {
    if (selectedDocs?.length) {
      posts = selectedDocs
        .map((post) => {
          if (typeof post.value === 'object') return post.value
        })
        .filter(
          (product): product is Product =>
            typeof product === 'object' && product !== null && isPublicStorefrontProduct(product),
        )
    }
  }

  return (
    <div className="my-16" id={`block-${id}`}>
      {introContent && (
        <div className="container mb-16">
          <RichText className="ml-0 max-w-3xl" data={introContent} enableGutter={false} />
        </div>
      )}
      <CollectionArchive posts={posts} />
    </div>
  )
}
