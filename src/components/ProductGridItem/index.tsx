'use client'

import type { Product, Variant } from '@/payload-types'

import { Media } from '@/components/Media'
import { Price } from '@/components/Price'
import { getProductFallbackImage } from '@/utilities/products'
import { useCurrency } from '@payloadcms/plugin-ecommerce/client/react'
import clsx from 'clsx'
import Link from 'next/link'
import React from 'react'

type Props = {
  product: Partial<Product>
}

export const ProductGridItem: React.FC<Props> = ({ product }) => {
  const { currency } = useCurrency()
  const currencyCode = currency.code.toUpperCase()
  const productPriceField = `priceIn${currencyCode}` as keyof Product
  const variantPriceField = `priceIn${currencyCode}` as keyof Variant

  const productPrice = product[productPriceField]
  let price = typeof productPrice === 'number' ? productPrice : undefined

  const variants = product.variants?.docs

  if (variants && variants.length > 0) {
    const variant = variants[0]

    if (variant && typeof variant === 'object') {
      const dynamicVariantPrice = variant[variantPriceField]
      const variantPrice = typeof dynamicVariantPrice === 'number' ? dynamicVariantPrice : undefined

      if (typeof variantPrice === 'number') {
        price = variantPrice
      }
    }
  }

  const image =
    product.gallery?.[0]?.image && typeof product.gallery[0]?.image === 'object'
      ? product.gallery[0]?.image
      : false
  const fallbackImage = getProductFallbackImage(product)

  return (
    <Link className="relative inline-block h-full w-full group" href={`/products/${product.slug}`}>
      {image || fallbackImage ? (
        <div className="relative aspect-square overflow-hidden rounded-2xl border bg-primary-foreground p-8">
          {image ? (
            <Media
              className="relative h-full w-full object-cover"
              height={80}
              imgClassName={clsx('h-full w-full object-cover rounded-2xl', {
                'transition duration-300 ease-in-out group-hover:scale-102': true,
              })}
              resource={image}
              width={80}
            />
          ) : fallbackImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={product.title || ''}
              className="h-full w-full rounded-2xl object-cover"
              src={fallbackImage}
            />
          ) : null}
        </div>
      ) : null}

      <div className="font-mono text-primary/50 group-hover:text-primary flex justify-between items-center mt-4">
        <div>{product.title}</div>

        {typeof price === 'number' && (
          <div className="">
            <Price amount={price} />
          </div>
        )}
      </div>
    </Link>
  )
}
