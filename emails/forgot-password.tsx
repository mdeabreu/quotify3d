import type { User } from '@/payload-types'
import type { PayloadRequest } from 'payload'

import { ActionEmail } from './components/action-email'

type ForgotPasswordEmailArgs =
  | {
      req?: PayloadRequest
      token?: string
      user?: User
      cta: {
        buttonLabel: string
        url: string
      }
      content: string
      headline: string
      email: string
    }
  | undefined

export default function ForgotPasswordEmail(args: ForgotPasswordEmailArgs) {
  const email = args?.email || 'your account'

  return (
    <ActionEmail
      body={[
        args?.content || 'Use the secure link below to choose a new password.',
        <>This link is meant for {email} and will take you to the password reset screen.</>,
      ]}
      cta={{
        label: args?.cta.buttonLabel || 'Reset password',
        url: args?.cta.url || '#',
      }}
      eyebrow="Account access"
      footer={
        <>
          You received this email because someone requested a password reset for {email}. If this
          was not you, you can safely ignore it.
        </>
      }
      headline={args?.headline || 'Reset your password'}
      preview="Reset your password."
    />
  )
}

ForgotPasswordEmail.PreviewProps = {
  cta: {
    buttonLabel: 'Reset password',
    url: 'http://localhost:3000/test',
  },
  content: "Let's get you back in",
  headline: 'Locked out?',
  email: 'nick@nlvogel.com',
}
