'use client'

import { Button } from '@/components/ui/button'
import { useCart } from '@payloadcms/plugin-ecommerce/client/react'
import React, { useCallback } from 'react'
import { toast } from 'sonner'

type Props = {
  productID: number
  quantity: number
}

export const AddQuoteItemToCartButton: React.FC<Props> = ({ productID, quantity }) => {
  const { addItem, isLoading } = useCart()

  const addToCart = useCallback(async () => {
    const safeQuantity = Math.max(1, quantity)

    await addItem(
      {
        product: productID,
      },
      safeQuantity,
    )

    toast.success('Item added to cart.')
  }, [addItem, productID, quantity])

  return (
    <Button
      aria-label="Add quote item to cart"
      className="w-full sm:w-auto"
      disabled={isLoading}
      onClick={addToCart}
      type="button"
      variant="outline"
    >
      Add to cart
    </Button>
  )
}
