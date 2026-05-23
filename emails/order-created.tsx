import { ActionEmail } from './components/action-email'

type OrderCreatedEmailProps = {
  orderID: number
  orderURL: string
}

export default function OrderCreatedEmail({ orderID, orderURL }: OrderCreatedEmailProps) {
  return (
    <ActionEmail
      body={[
        `Your order #${orderID} has been placed successfully.`,
        'You can use the link below to come back and review your order details at any time.',
      ]}
      cta={{
        label: `View order #${orderID}`,
        url: orderURL,
      }}
      eyebrow="Order placed"
      footer="You received this email because this address is attached to a placed order."
      headline="Your order has been placed"
      preview={`Your order #${orderID} has been placed.`}
    />
  )
}

OrderCreatedEmail.PreviewProps = {
  orderID: 456,
  orderURL: 'http://localhost:3000/orders/456',
}
