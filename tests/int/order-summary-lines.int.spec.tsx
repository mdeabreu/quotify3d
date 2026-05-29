import { render, screen } from '@testing-library/react'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'

import { OrderSummaryLines } from '@/components/OrderSummaryLines'

vi.mock('@payloadcms/plugin-ecommerce/client/react', () => ({
  useCurrency: () => ({
    formatCurrency: (amount: number, options?: { currency?: { code: string } }) =>
      `${options?.currency?.code || 'CAD'} ${(amount / 100).toFixed(2)}`,
    supportedCurrencies: [{ code: 'CAD' }, { code: 'USD' }],
  }),
}))

describe('OrderSummaryLines', () => {
  it('renders summary lines and total using the order currency', () => {
    render(
      <OrderSummaryLines
        currencyCode="USD"
        summary={{
          currency: 'USD',
          lines: [
            { amount: 12500, label: 'Subtotal', type: 'subtotal' },
            { amount: -2500, label: 'Coupon: SAVE20', type: 'discount' },
            { amount: 1500, label: 'Shipping', type: 'shipping' },
          ],
          total: 11500,
        }}
      />,
    )

    expect(screen.getByText('Order Summary')).toBeTruthy()
    expect(screen.getByText('Subtotal')).toBeTruthy()
    expect(screen.getByText('Coupon: SAVE20')).toBeTruthy()
    expect(screen.getByText('Shipping')).toBeTruthy()
    expect(screen.getByText('Total')).toBeTruthy()
    expect(screen.getByText('USD 125.00')).toBeTruthy()
    expect(screen.getByText('USD -25.00')).toBeTruthy()
    expect(screen.getByText('USD 15.00')).toBeTruthy()
    expect(screen.getByText('USD 115.00')).toBeTruthy()
  })

  it('renders nothing when there is no summary breakdown', () => {
    const { container } = render(<OrderSummaryLines />)

    expect(container.firstChild).toBeNull()
  })
})
