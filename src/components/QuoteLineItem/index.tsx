import { AddQuoteItemToCartButton } from '@/components/QuoteActions/AddQuoteItemToCartButton'
import { Price } from '@/components/Price'
import { Quote } from '@/payload-types'
import Link from 'next/link'

type Props = {
  item: Quote['items'][number]
  currencyCode?: string
  productID?: number
  productSlug?: string
}

const getRelationLabel = (relation: unknown, fallback: string) => {
  if (!relation || typeof relation !== 'object') return fallback

  if ('name' in relation && typeof relation.name === 'string') return relation.name
  if ('originalFilename' in relation && typeof relation.originalFilename === 'string') {
    return relation.originalFilename
  }

  return fallback
}

export const QuoteLineItem: React.FC<Props> = ({ item, currencyCode, productID, productSlug }) => {
  const modelLabel = getRelationLabel(item.model, 'Model')
  const filamentLabel = getRelationLabel(item.filament, 'Material')
  const colourLabel = getRelationLabel(item.colour, 'Colour')
  const processLabel = getRelationLabel(item.process, 'Process')
  const subtotal = typeof item.gcodePrice === 'number' ? item.gcodePrice * item.quantity : null

  return (
    <div className="bg-card border rounded-lg px-4 py-2 md:px-6 md:py-4 flex flex-col sm:flex-row gap-8 sm:items-center sm:justify-between">
      <div className="flex flex-col gap-3">
        <h3 className="text-lg font-medium">
          {productSlug ? <Link href={`/products/${productSlug}`}>{modelLabel}</Link> : modelLabel}
        </h3>

        <div className="text-sm font-mono text-primary/50 tracking-widest">
          <p>{filamentLabel}</p>
          <p>{colourLabel}</p>
          <p>{processLabel}</p>
        </div>

        <div>
          {'x'}
          {item.quantity}
        </div>
      </div>

      <div className="text-right">
        {typeof subtotal === 'number' ? (
          <>
            <p className="font-medium text-lg">Subtotal</p>
            <Price
              amount={subtotal}
              currencyCode={currencyCode}
              className="font-mono text-primary/50 text-sm"
            />
          </>
        ) : (
          <p className="font-mono text-primary/50 text-sm">Price pending</p>
        )}

        {typeof productID === 'number' && (
          <div className="mt-3">
            <AddQuoteItemToCartButton productID={productID} quantity={item.quantity} />
          </div>
        )}
      </div>
    </div>
  )
}
