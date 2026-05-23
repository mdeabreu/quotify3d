import { ActionEmail } from './components/action-email'

type AdminQuoteReadyForReviewEmailProps = {
  adminURL: string
  customerEmail?: string | null
  quoteID: number
}

export default function AdminQuoteReadyForReviewEmail({
  adminURL,
  customerEmail,
  quoteID,
}: AdminQuoteReadyForReviewEmailProps) {
  return (
    <ActionEmail
      body={[
        `Quote #${quoteID} has been submitted and is ready for admin review.`,
        customerEmail
          ? `Customer contact: ${customerEmail}.`
          : 'No customer email is attached to this quote.',
      ]}
      cta={{
        label: `Review quote #${quoteID}`,
        url: adminURL,
      }}
      eyebrow="Admin action required"
      footer="You received this email because your account has admin access."
      headline={`Quote #${quoteID} is ready for review`}
      preview={`Quote #${quoteID} is ready for review.`}
    />
  )
}

AdminQuoteReadyForReviewEmail.PreviewProps = {
  adminURL: 'http://localhost:3000/admin/collections/quotes/123',
  customerEmail: 'customer@example.com',
  quoteID: 123,
}
