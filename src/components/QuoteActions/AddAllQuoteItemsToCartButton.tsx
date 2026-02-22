'use client'

import { Button } from '@/components/ui/button'
import { useCart } from '@payloadcms/plugin-ecommerce/client/react'
import React, { useCallback } from 'react'
import { toast } from 'sonner'

type AddableQuoteItem = {
  productID: number
  quantity: number
}

type Props = {
  items: AddableQuoteItem[]
}

export const AddAllQuoteItemsToCartButton: React.FC<Props> = ({ items }) => {
  const { addItem, isLoading } = useCart()

  const addAllToCart = useCallback(async () => {
    if (!items.length) return

    for (const item of items) {
      await addItem(
        {
          product: item.productID,
        },
        Math.max(1, item.quantity),
      )
    }

    toast.success('All available quote items added to cart.')
  }, [addItem, items])

  return (
    <Button
      aria-label="Add all quote items to cart"
      disabled={isLoading || items.length === 0}
      onClick={addAllToCart}
      type="button"
      variant="outline"
    >
      Add all to cart
    </Button>
  )
}
