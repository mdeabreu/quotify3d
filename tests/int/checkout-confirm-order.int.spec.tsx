import { cleanup, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ConfirmOrder } from '@/components/checkout/ConfirmOrder'
import { buildStripeReturnURL } from '@/components/forms/CheckoutForm'

const push = vi.fn()
const confirmOrder = vi.fn()

let cart: { items?: unknown[] } | undefined
let currentSearchParams = ''

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={typeof href === 'string' ? href : '#'} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push,
  }),
  useSearchParams: () => new URLSearchParams(currentSearchParams),
}))

vi.mock('@payloadcms/plugin-ecommerce/client/react', () => ({
  useCart: () => ({
    cart,
    clearCart: vi.fn(),
  }),
  useElements: () => ({}),
  usePayments: () => ({
    confirmOrder,
  }),
  useStripe: () => ({}),
}))

vi.mock('@stripe/react-stripe-js', () => ({
  PaymentElement: () => <div />,
  useElements: () => ({}),
  useStripe: () => ({}),
}))

describe('checkout confirmation recovery', () => {
  beforeEach(() => {
    cart = {
      items: [{ id: 'cart-item-1' }],
    }
    currentSearchParams = 'payment_intent=pi_123&email=customer%2Blaunch%40example.com'
    push.mockReset()
    confirmOrder.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('encodes guest email values in the Stripe return URL', () => {
    const originalServerURL = process.env.NEXT_PUBLIC_SERVER_URL
    process.env.NEXT_PUBLIC_SERVER_URL = 'https://shop.example.test'

    expect(buildStripeReturnURL('customer+launch@example.com')).toBe(
      'https://shop.example.test/checkout/confirm-order?email=customer%2Blaunch%40example.com',
    )

    process.env.NEXT_PUBLIC_SERVER_URL = originalServerURL
  })

  it('shows recovery UI when the redirect has a payment intent but no cart items', async () => {
    cart = {
      items: [],
    }

    render(<ConfirmOrder />)

    expect(await screen.findByText('Order confirmation needs attention')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Find order' }).getAttribute('href')).toBe(
      '/find-order',
    )
    expect(screen.queryByText('Confirming Order')).toBeNull()
    expect(confirmOrder).not.toHaveBeenCalled()
  })

  it('shows recovery UI when order confirmation rejects', async () => {
    confirmOrder.mockRejectedValue(new Error('Payment not completed.'))

    render(<ConfirmOrder />)

    expect(await screen.findByText('Order confirmation needs attention')).toBeTruthy()
    expect(screen.getByText(/Payment not completed/)).toBeTruthy()
    expect(confirmOrder).toHaveBeenCalledWith('stripe', {
      additionalData: {
        customerEmail: 'customer+launch@example.com',
        paymentIntentID: 'pi_123',
      },
    })
  })

  it('shows recovery UI when confirmation succeeds without an order ID', async () => {
    confirmOrder.mockResolvedValue({})

    render(<ConfirmOrder />)

    expect(await screen.findByText('Order confirmation needs attention')).toBeTruthy()
    expect(screen.getByText(/No order ID was returned/)).toBeTruthy()
    expect(push).not.toHaveBeenCalledWith(expect.stringContaining('/orders/'))
  })

  it('redirects to the order with encoded email and access token after confirmation succeeds', async () => {
    confirmOrder.mockResolvedValue({
      accessToken: 'token+abc',
      orderID: 'order-123',
    })

    render(<ConfirmOrder />)

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith(
        '/orders/order-123?email=customer%2Blaunch%40example.com&accessToken=token%2Babc',
      )
    })
  })
})
