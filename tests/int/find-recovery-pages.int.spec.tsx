import { render, screen } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const authState = vi.hoisted(() => ({
  user: null as null | { id: number; email: string },
}))

const redirectMock = vi.hoisted(() =>
  vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`)
  }),
)

vi.mock('@payload-config', () => ({
  default: {},
}))

vi.mock('next/headers.js', () => ({
  headers: vi.fn(async () => new Headers()),
}))

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}))

vi.mock('payload', () => ({
  getPayload: vi.fn(async () => ({
    auth: vi.fn(async () => ({
      user: authState.user,
    })),
  })),
}))

vi.mock('@/components/forms/FindQuoteForm', () => ({
  FindQuoteForm: () => React.createElement('div', null, 'Find quote form'),
}))

vi.mock('@/components/forms/FindOrderForm', () => ({
  FindOrderForm: () => React.createElement('div', null, 'Find order form'),
}))

import FindOrderPage from '@/app/(app)/find-order/page'
import FindQuotePage from '@/app/(app)/find-quote/page'

describe('find recovery pages', () => {
  beforeEach(() => {
    authState.user = null
    redirectMock.mockClear()
  })

  it('redirects logged-in users from find quote to their quote list', async () => {
    authState.user = { id: 1, email: 'customer@example.com' }

    await expect(FindQuotePage()).rejects.toThrow('REDIRECT:/quotes')
    expect(redirectMock).toHaveBeenCalledWith('/quotes')
  })

  it('redirects logged-in users from find order to their order list', async () => {
    authState.user = { id: 1, email: 'customer@example.com' }

    await expect(FindOrderPage()).rejects.toThrow('REDIRECT:/orders')
    expect(redirectMock).toHaveBeenCalledWith('/orders')
  })

  it('renders the find quote form for anonymous users', async () => {
    render(await FindQuotePage())

    expect(screen.getByText('Find quote form')).toBeTruthy()
    expect(redirectMock).not.toHaveBeenCalled()
  })

  it('renders the find order form for anonymous users', async () => {
    render(await FindOrderPage())

    expect(screen.getByText('Find order form')).toBeTruthy()
    expect(redirectMock).not.toHaveBeenCalled()
  })
})
