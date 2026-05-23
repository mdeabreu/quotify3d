import { ActionEmail } from './components/action-email'

type AdminOrderCreatedEmailProps = {
  adminURL: string
  customerEmail?: string | null
  orderID: number
}

export default function AdminOrderCreatedEmail({
  adminURL,
  customerEmail,
  orderID,
}: AdminOrderCreatedEmailProps) {
  return (
    <ActionEmail
      body={[
        `Order #${orderID} has been created and is ready for fulfillment.`,
        customerEmail
          ? `Customer contact: ${customerEmail}.`
          : 'No customer email is attached to this order.',
      ]}
      cta={{
        label: `Review order #${orderID}`,
        url: adminURL,
      }}
      eyebrow="Admin action required"
      footer="You received this email because your account has admin access."
      headline={`Order #${orderID} has been created`}
      preview={`Order #${orderID} has been created.`}
    />
  )
}

AdminOrderCreatedEmail.PreviewProps = {
  adminURL: 'http://localhost:3000/admin/collections/orders/456',
  customerEmail: 'customer@example.com',
  orderID: 456,
}
