'use client'

import { Button } from '@/components/ui/button'
import { useCart } from '@payloadcms/plugin-ecommerce/client/react'
import React, { useCallback, useEffect, useState } from 'react'
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
  const [pendingItems, setPendingItems] = useState<AddableQuoteItem[]>([])

  const addAllToCart = useCallback(async () => {
    if (!items.length || pendingItems.length) return

    const [firstItem, ...remainingItems] = items

    if (!firstItem) return

    await addItem(
      {
        product: firstItem.productID,
      },
      Math.max(1, firstItem.quantity),
    )

    if (remainingItems.length) {
      setPendingItems(remainingItems)
      return
    }

    toast.success('All available quote items added to cart.')
  }, [addItem, items, pendingItems.length])

  useEffect(() => {
    if (!pendingItems.length) return

    let isCancelled = false

    const addPendingItems = async () => {
      for (const item of pendingItems) {
        if (isCancelled) return

        await addItem(
          {
            product: item.productID,
          },
          Math.max(1, item.quantity),
        )
      }

      if (!isCancelled) {
        setPendingItems([])
        toast.success('All available quote items added to cart.')
      }
    }

    void addPendingItems()

    return () => {
      isCancelled = true
    }
  }, [addItem, pendingItems])

  const isAddingAllItems = isLoading || pendingItems.length > 0

  return (
    <Button
      aria-label="Add all quote items to cart"
      disabled={isAddingAllItems || items.length === 0}
      onClick={addAllToCart}
      type="button"
      variant="outline"
    >
      Add all to cart
    </Button>
  )
}
