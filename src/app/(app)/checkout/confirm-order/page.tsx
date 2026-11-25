import type { Metadata } from 'next'

import { getMergedOpenGraph } from '@/utilities/mergeOpenGraph'
import React, { Fragment } from 'react'
import { ConfirmOrder } from '@/components/checkout/ConfirmOrder'

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

export default async function ConfirmOrderPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: SearchParams
}) {
  const searchParams = await searchParamsPromise

  const paymentIntent = searchParams.paymentId

  return (
    <div className="container min-h-[90vh] flex py-12">
      <ConfirmOrder />
    </div>
  )
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    description: 'Confirm order.',
    openGraph: await getMergedOpenGraph({
      title: 'Confirming order',
      url: '/checkout/confirm-order',
    }),
    title: 'Confirming order',
  }
}
