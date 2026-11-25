import type { Metadata } from 'next'

import { getMergedOpenGraph } from '@/utilities/mergeOpenGraph'
import React from 'react'

import { ForgotPasswordForm } from '@/components/forms/ForgotPasswordForm'

export default async function ForgotPasswordPage() {
  return (
    <div className="container py-16">
      <ForgotPasswordForm />
    </div>
  )
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    description: 'Enter your email address to recover your password.',
    openGraph: await getMergedOpenGraph({
      title: 'Forgot Password',
      url: '/forgot-password',
    }),
    title: 'Forgot Password',
  }
}
