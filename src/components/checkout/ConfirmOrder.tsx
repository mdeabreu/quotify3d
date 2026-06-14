'use client'

import { LoadingSpinner } from '@/components/LoadingSpinner'
import { Message } from '@/components/Message'
import { Button } from '@/components/ui/button'
import { useCart, usePayments } from '@payloadcms/plugin-ecommerce/client/react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

const recoverableConfirmationMessage =
  'We could not confirm your order from this page. Your payment may still have succeeded; use Find order with your email to retrieve the order details.'

export const ConfirmOrder: React.FC = () => {
  const { confirmOrder } = usePayments()
  const { cart } = useCart()
  const [confirmationError, setConfirmationError] = useState<null | string>(null)

  const searchParams = useSearchParams()
  const router = useRouter()
  // Ensure we only confirm the order once, even if the component re-renders
  const isConfirming = useRef(false)
  const paymentIntentID = searchParams.get('payment_intent')
  const email = searchParams.get('email')
  const isCartLoaded = Boolean(cart)
  const hasCartItems = Boolean(cart?.items?.length)
  const missingCartError =
    paymentIntentID && isCartLoaded && !hasCartItems ? recoverableConfirmationMessage : null
  const error = missingCartError || confirmationError

  useEffect(() => {
    if (!paymentIntentID) {
      // If no payment intent ID is found, redirect to the home
      router.push('/')
      return
    }

    if (!isCartLoaded || !hasCartItems) {
      return
    }

    if (!isConfirming.current) {
      isConfirming.current = true

      void (async () => {
        try {
          const result = await confirmOrder('stripe', {
            additionalData: {
              paymentIntentID,
              ...(email ? { customerEmail: email } : {}),
            },
          })

          if (!result || typeof result !== 'object' || !('orderID' in result) || !result.orderID) {
            throw new Error('No order ID was returned after payment confirmation.')
          }

          const accessToken = 'accessToken' in result ? (result.accessToken as string) : ''
          const queryParams = new URLSearchParams()

          if (email) {
            queryParams.set('email', email)
          }
          if (accessToken) {
            queryParams.set('accessToken', accessToken)
          }

          const queryString = queryParams.toString()
          router.push(`/orders/${result.orderID}${queryString ? `?${queryString}` : ''}`)
        } catch (error) {
          const message = error instanceof Error ? error.message : recoverableConfirmationMessage
          setConfirmationError(`${recoverableConfirmationMessage} ${message}`)
        }
      })()
    }
  }, [confirmOrder, email, hasCartItems, isCartLoaded, paymentIntentID, router])

  if (error) {
    return (
      <div className="text-center w-full flex flex-col items-center justify-start gap-4">
        <h1 className="text-2xl">Order confirmation needs attention</h1>
        <Message className="max-w-xl text-left" error={error} />
        <Button asChild variant="default">
          <Link href="/find-order">Find order</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="text-center w-full flex flex-col items-center justify-start gap-4">
      <h1 className="text-2xl">Confirming Order</h1>

      <LoadingSpinner className="w-12 h-6" />
    </div>
  )
}
