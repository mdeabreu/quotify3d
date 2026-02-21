import type { Media, Product, ThreeItemGridBlock as ThreeItemGridBlockProps, Variant } from '@/payload-types'

import { GridTileImage } from '@/components/Grid/tile'
import { getDefaultPriceField } from '@/utilities/currency'
import Link from 'next/link'
import React from 'react'
import type { DefaultDocumentIDType } from 'payload'

type Props = { item: Product; priority?: boolean; size: 'full' | 'half' }

export const ThreeItemGridItem: React.FC<Props> = ({ item, size }) => {
  const productPriceField = getDefaultPriceField() as keyof Product
  const variantPriceField = getDefaultPriceField() as keyof Variant
  const itemPrice = item[productPriceField]
  let price = typeof itemPrice === 'number' ? itemPrice : undefined

  if (item.enableVariants && item.variants?.docs?.length) {
    const variant = item.variants.docs[0]

    if (variant && typeof variant === 'object') {
      const variantPrice = variant[variantPriceField]
      if (typeof variantPrice === 'number') {
        price = variantPrice
      }
    }
  }

  return (
    <div
      className={size === 'full' ? 'md:col-span-4 md:row-span-2' : 'md:col-span-2 md:row-span-1'}
    >
      <Link className="relative block aspect-square h-full w-full" href={`/products/${item.slug}`}>
        <GridTileImage
          label={
            typeof price === 'number'
              ? {
                  amount: price,
                  position: size === 'full' ? 'center' : 'bottom',
                  title: item.title,
                }
              : undefined
          }
          media={item.meta?.image as Media}
        />
      </Link>
    </div>
  )
}

export const ThreeItemGridBlock: React.FC<
  ThreeItemGridBlockProps & {
    id?: DefaultDocumentIDType
    className?: string
  }
> = async ({ products }) => {
  if (!products || !products[0] || !products[1] || !products[2]) return null

  const [firstProduct, secondProduct, thirdProduct] = products

  return (
    <section className="container grid gap-4 pb-4 md:grid-cols-6 md:grid-rows-2">
      <ThreeItemGridItem item={firstProduct as Product} priority size="full" />
      <ThreeItemGridItem item={secondProduct as Product} priority size="half" />
      <ThreeItemGridItem item={thirdProduct as Product} size="half" />
    </section>
  )
}
