import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { QuoteWizard } from '@/components/QuoteWizard'

let currentUser: { email: string } | null | undefined = { email: 'customer@example.com' }

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={typeof href === 'string' ? href : '#'} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('@/providers/Auth', () => ({
  useAuth: () => ({ user: currentUser }),
}))

const startQuoteAction = vi.fn(async () => ({}))

describe('QuoteWizard', () => {
  afterEach(() => {
    cleanup()
    startQuoteAction.mockClear()
    currentUser = { email: 'customer@example.com' }
  })

  it('shows the signed-in account instead of asking for an email', () => {
    render(<QuoteWizard startQuoteAction={startQuoteAction} />)

    expect(screen.getByText('customer@example.com')).toBeTruthy()
    expect(screen.queryByLabelText('Email address')).toBeNull()
  })

  it('requires a guest email and offers account links', () => {
    currentUser = null
    render(<QuoteWizard startQuoteAction={startQuoteAction} />)

    expect(screen.getByLabelText('Email address')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Log in' }).getAttribute('href')).toBe('/login')
    expect(screen.getByRole('link', { name: 'create one' }).getAttribute('href')).toBe(
      '/create-account',
    )
  })

  it('shows selected models and enables continue', () => {
    const { container } = render(<QuoteWizard startQuoteAction={startQuoteAction} />)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement

    fireEvent.change(input, {
      target: {
        files: [new File(['solid'], 'model.3mf'), new File(['mesh'], 'second.stl')],
      },
    })

    expect(input.hasAttribute('multiple')).toBe(true)
    expect(screen.getByText('2 files selected')).toBeTruthy()
    expect(screen.getByText('model.3mf, second.stl')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Upload files and continue' }).hasAttribute('disabled'),
    ).toBe(false)
  })

  it('rejects unsupported files before submission', () => {
    const { container } = render(<QuoteWizard startQuoteAction={startQuoteAction} />)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement

    fireEvent.change(input, { target: { files: [new File(['text'], 'notes.txt')] } })

    expect(screen.getByText(/Unsupported file format/i)).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Upload files and continue' }).hasAttribute('disabled'),
    ).toBe(true)
  })
})
