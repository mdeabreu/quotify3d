import { ActionEmail } from './components/action-email'

type OrderAccessEmailProps = {
  orderID: number
  orderURL: string
}

export default function OrderAccessEmail({ orderID, orderURL }: OrderAccessEmailProps) {
  return (
    <ActionEmail
      body={[
        `Use the secure link below to view order #${orderID}.`,
        'This link will give you access to view your order details.',
      ]}
      cta={{
        label: `View order #${orderID}`,
        url: orderURL,
      }}
      eyebrow="Order access"
      footer="You received this email because someone requested access to this order."
      headline="View your order"
      preview={`Access your order #${orderID}.`}
    />
  )
}

OrderAccessEmail.PreviewProps = {
  orderID: 456,
  orderURL: 'http://localhost:3000/orders/456?email=test@example.com&accessToken=test-token',
}
