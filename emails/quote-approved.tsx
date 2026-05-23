import { ActionEmail } from './components/action-email'

type QuoteApprovedEmailProps = {
  quoteID: number
  quoteURL: string
}

export default function QuoteApprovedEmail({ quoteID, quoteURL }: QuoteApprovedEmailProps) {
  return (
    <ActionEmail
      body={[
        `Your quote #${quoteID} has been approved and is ready for you to review.`,
        'You can now return to your quote, add the approved items to your cart, and complete checkout.',
      ]}
      cta={{
        label: `View quote #${quoteID}`,
        url: quoteURL,
      }}
      eyebrow="Quote approved"
      footer="You received this email because this address is attached to an approved quote."
      headline="Your quote is approved"
      preview={`Your quote #${quoteID} is approved.`}
    />
  )
}

QuoteApprovedEmail.PreviewProps = {
  quoteID: 123,
  quoteURL: 'http://localhost:3000/quotes/123',
}
