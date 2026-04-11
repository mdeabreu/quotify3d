import { redirect } from 'next/navigation'

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ email?: string }>
}

export default async function EditQuoteRedirectPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const { email = '' } = await searchParams

  redirect(`/quotes/${id}${email ? `?email=${encodeURIComponent(email)}` : ''}`)
}
