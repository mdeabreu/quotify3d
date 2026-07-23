import { ActionEmail } from './components/action-email'

type QuoteCreatedEmailProps = {
  quoteID: number
  quoteURL: string
}

export default function QuoteCreatedEmail({ quoteID, quoteURL }: QuoteCreatedEmailProps) {
  return (
    <ActionEmail
      body={[
        `We saved your model in draft quote #${quoteID}. It has not been submitted for review yet.`,
        'Use the link below to choose your material, colours, and print profile when you’re ready.',
      ]}
      cta={{
        label: `Continue draft quote #${quoteID}`,
        url: quoteURL,
      }}
      eyebrow="Draft quote"
      footer="You received this email because this address was used to create a draft quote."
      headline="Your draft quote is ready"
      preview={`Your draft quote #${quoteID} is ready.`}
    />
  )
}

QuoteCreatedEmail.PreviewProps = {
  quoteID: 123,
  quoteURL: 'http://localhost:3000/quotes/123',
}
