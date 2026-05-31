import { Price } from '@/components/Price'
import { Product, Variant } from '@/payload-types'
import { getProductFallbackImage } from '@/utilities/products'
import Link from 'next/link'

type Props = {
  product: Product
  style?: 'compact' | 'default'
  variant?: Variant
  quantity?: number
  /**
   * Force all formatting to a particular currency.
   */
  currencyCode?: string
}

export const ProductItem: React.FC<Props> = ({
  product,
  quantity,
  variant,
  currencyCode,
}) => {
  const { title } = product

  const metaImage =
    product.meta?.image && typeof product.meta?.image === 'object' ? product.meta.image : undefined

  const firstGalleryImage =
    typeof product.gallery?.[0]?.image === 'object' ? product.gallery?.[0]?.image : undefined

  let image = firstGalleryImage || metaImage

  const isVariant = Boolean(variant) && typeof variant === 'object'

  if (isVariant) {
    const imageVariant = product.gallery?.find((item) => {
      if (!item.variantOption) return false
      const variantOptionID =
        typeof item.variantOption === 'object' ? item.variantOption.id : item.variantOption

      const hasMatch = variant?.options?.some((option) => {
        if (typeof option === 'object') return option.id === variantOptionID
        else return option === variantOptionID
      })

      return hasMatch
    })

    if (imageVariant && typeof imageVariant.image === 'object') {
      image = imageVariant.image
    }
  }

  const normalizedCurrencyCode = currencyCode?.toUpperCase()
  const productPriceField = normalizedCurrencyCode
    ? (`priceIn${normalizedCurrencyCode}` as keyof Product)
    : undefined
  const variantPriceField = normalizedCurrencyCode
    ? (`priceIn${normalizedCurrencyCode}` as keyof Variant)
    : undefined
  const dynamicVariantPrice = variantPriceField ? variant?.[variantPriceField] : undefined
  const variantPrice = typeof dynamicVariantPrice === 'number' ? dynamicVariantPrice : undefined
  const dynamicProductPrice = productPriceField ? product[productPriceField] : undefined
  const productPrice = typeof dynamicProductPrice === 'number' ? dynamicProductPrice : undefined
  const itemPrice = variantPrice ?? productPrice

  const itemURL = `/products/${product.slug}${variant ? `?variant=${variant.id}` : ''}`
  const fallbackImage = getProductFallbackImage(product)

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-stretch justify-stretch h-20 w-20 p-2 rounded-lg border">
        <div className="relative w-full h-full">
          {image?.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={image.alt || product.title || ''}
              className="h-full w-full rounded-lg object-cover"
              src={image.url}
            />
          ) : fallbackImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={product.title || ''}
              className="h-full w-full rounded-lg object-cover"
              src={fallbackImage}
            />
          ) : null}
        </div>
      </div>
      <div className="flex grow justify-between items-center">
        <div className="flex flex-col gap-1">
          <p className="font-medium text-lg">
            <Link href={itemURL}>{title}</Link>
          </p>
          {variant && (
            <p className="text-sm font-mono text-primary/50 tracking-widest">
              {variant.options
                ?.map((option) => {
                  if (typeof option === 'object') return option.label
                  return null
                })
                .join(', ')}
            </p>
          )}
          <div>
            {'x'}
            {quantity}
          </div>
        </div>

        {typeof itemPrice === 'number' && quantity && (
          <div className="text-right">
            <p className="font-medium text-lg">Subtotal</p>
            <Price
              className="font-mono text-primary/50 text-sm"
              amount={itemPrice * quantity}
              currencyCode={currencyCode}
            />
          </div>
        )}
      </div>
    </div>
  )
}
