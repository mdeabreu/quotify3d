import { ActionEmail } from './components/action-email'

type QuoteAccessEmailProps = {
  quoteID: number
  quoteURL: string
}

export default function QuoteAccessEmail({ quoteID, quoteURL }: QuoteAccessEmailProps) {
  return (
    <ActionEmail
      body={[
        `Use the secure link below to view quote #${quoteID}.`,
        'This link will give you access to view your quote details.',
      ]}
      cta={{
        label: `View quote #${quoteID}`,
        url: quoteURL,
      }}
      eyebrow="Quote access"
      footer="You received this email because someone requested access to this quote."
      headline="View your quote"
      preview={`Access your quote #${quoteID}.`}
    />
  )
}

QuoteAccessEmail.PreviewProps = {
  quoteID: 123,
  quoteURL: 'http://localhost:3000/quotes/123?email=test@example.com&accessToken=test-token',
}
