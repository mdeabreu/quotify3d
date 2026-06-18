import { describe, expect, it } from 'vitest'

import { buildStripeMetadata } from './initiatePayment'

describe('buildStripeMetadata', () => {
  it('serializes values that fit within Stripe metadata limits', () => {
    const metadata = buildStripeMetadata({
      cartID: 123,
      cartItemsSnapshot: [{ id: 'item-1', product: 1, quantity: 1 }],
      shippingAddress: { city: 'Vancouver' },
    })

    expect(metadata.cartID).toBe('123')
    expect(metadata.cartItemsSnapshot).toBe(
      JSON.stringify([{ id: 'item-1', product: 1, quantity: 1 }]),
    )
    expect(Object.values(metadata).every((value) => value.length <= 500)).toBe(true)
  })

  it('omits values that exceed Stripe metadata value limits', () => {
    const oversizedSnapshot = Array.from({ length: 9 }, (_, index) => ({
      id: `6a336d0e54b4690001c6221${index}`,
      product: index + 1,
      quantity: 1,
    }))

    const metadata = buildStripeMetadata({
      cartID: 123,
      cartItemsSnapshot: oversizedSnapshot,
    })

    expect(JSON.stringify(oversizedSnapshot).length).toBeGreaterThan(500)
    expect(metadata.cartID).toBe('123')
    expect(metadata.cartItemsSnapshot).toBeUndefined()
    expect(Object.values(metadata).every((value) => value.length <= 500)).toBe(true)
  })
})
