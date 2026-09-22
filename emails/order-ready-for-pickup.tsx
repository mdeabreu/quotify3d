import { ActionEmail } from './components/action-email'

type Props = {
  instructions: string
  orderID: number
  orderURL: string
  pickupLabel: string
}

export default function OrderReadyForPickupEmail({
  instructions,
  orderID,
  orderURL,
  pickupLabel,
}: Props) {
  return (
    <ActionEmail
      body={[`Your order #${orderID} is ready for ${pickupLabel.toLowerCase()}.`, instructions]}
      cta={{ label: `View order #${orderID}`, url: orderURL }}
      eyebrow="Ready for pickup"
      footer="You received this email because this address is attached to a pickup order."
      headline="Your order is ready"
      preview={`Your order #${orderID} is ready for pickup.`}
    />
  )
}

OrderReadyForPickupEmail.PreviewProps = {
  instructions: 'Collect from the front desk during business hours.',
  orderID: 456,
  orderURL: 'http://localhost:3000/orders/456',
  pickupLabel: 'Local pickup',
}
