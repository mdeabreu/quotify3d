import { render } from '@react-email/components'
import { describe, expect, it } from 'vitest'

import OrderCreatedEmail from '../../emails/order-created'
import OrderReadyForPickupEmail from '../../emails/order-ready-for-pickup'

describe('pickup order email copy', () => {
  it('uses the configured pickup label when an order is placed', async () => {
    const html = await render(
      OrderCreatedEmail({
        orderID: 123,
        orderURL: 'https://example.com/orders/123',
        pickupLabel: 'Studio collection',
      }),
    )

    expect(html).toContain('This order is for studio collection.')
    expect(html).not.toContain('Shipping Address')
  })

  it('renders the frozen ready instructions and secure order URL', async () => {
    const html = await render(
      OrderReadyForPickupEmail({
        instructions: 'Use the side entrance after 10:00.',
        orderID: 123,
        orderURL: 'https://example.com/orders/123?email=guest%40example.com&accessToken=secret',
        pickupLabel: 'Studio collection',
      }),
    )

    expect(html).toContain('ready for studio collection')
    expect(html).toContain('Use the side entrance after 10:00.')
    expect(html).toContain('accessToken=secret')
  })
})
