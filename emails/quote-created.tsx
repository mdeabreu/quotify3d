import { ActionEmail } from './components/action-email'

type QuoteCreatedEmailProps = {
  quoteID: number
  quoteURL: string
}

export default function QuoteCreatedEmail({ quoteID, quoteURL }: QuoteCreatedEmailProps) {
  return (
    <ActionEmail
      body={[
        `Your quote #${quoteID} has been created successfully.`,
        'You can use the link below to come back and review your quote at any time.',
      ]}
      cta={{
        label: `View quote #${quoteID}`,
        url: quoteURL,
      }}
      eyebrow="Quote request"
      footer="You received this email because this address was used to create a quote request."
      headline="Your quote has been created"
      preview={`Your quote #${quoteID} has been created.`}
    />
  )
}

QuoteCreatedEmail.PreviewProps = {
  quoteID: 123,
  quoteURL: 'http://localhost:3000/quotes/123',
}
