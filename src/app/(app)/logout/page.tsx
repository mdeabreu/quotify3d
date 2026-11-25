import type { Metadata } from 'next'

import { getMergedOpenGraph } from '@/utilities/mergeOpenGraph'
import React from 'react'

import { LogoutPage } from './LogoutPage'

export default async function Logout() {
  return (
    <div className="container max-w-lg my-16">
      <LogoutPage />
    </div>
  )
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    description: 'You have been logged out.',
    openGraph: await getMergedOpenGraph({
      title: 'Logout',
      url: '/logout',
    }),
    title: 'Logout',
  }
}
