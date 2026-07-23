import { render } from '@react-email/components'
import { describe, expect, it } from 'vitest'

import QuoteApprovedEmail from '../../emails/quote-approved'
import QuoteCreatedEmail from '../../emails/quote-created'

describe('customer quote email copy', () => {
  it('describes a newly created quote as an unsubmitted draft', async () => {
    const html = await render(
      QuoteCreatedEmail({ quoteID: 123, quoteURL: 'https://example.com/quotes/123' }),
    )

    expect(html).toContain('Your draft quote is ready')
    expect(html).toContain('It has not been submitted for review yet.')
    expect(html).toContain('Continue draft quote #123')
    expect(html).toContain('print profile')
  })

  it('directs approved customers toward checkout', async () => {
    const html = await render(
      QuoteApprovedEmail({ quoteID: 123, quoteURL: 'https://example.com/quotes/123' }),
    )

    expect(html).toContain('Your quote is approved')
    expect(html).toContain('Review quote #123 and checkout')
  })
})
