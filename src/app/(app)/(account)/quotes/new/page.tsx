import type { Metadata } from 'next'

import { QuoteWizard, type StartQuoteState } from '@/components/QuoteWizard'
import { isSupportedModelFilename, MODEL_UPLOAD_FORMAT_LABEL } from '@/lib/modelUploadFormats'
import { cleanupUploadedModels, uploadQuoteModels } from '@/lib/quotes/modelUploads'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import configPromise from '@payload-config'
import { headers as getHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const startQuoteAction = async (
  _state: StartQuoteState,
  formData: FormData,
): Promise<StartQuoteState> => {
  'use server'

  const files = formData
    .getAll('files')
    .filter((value): value is File => value instanceof File && value.size > 0)
  if (!files.length) return { error: 'Choose at least one model file.' }
  if (files.some((file) => !isSupportedModelFilename(file.name))) {
    return {
      error: `One or more files use an unsupported format. Accepted formats: ${MODEL_UPLOAD_FORMAT_LABEL}.`,
    }
  }

  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: await getHeaders() })
  const customerEmail = String(formData.get('customerEmail') ?? '')
    .trim()
    .toLowerCase()

  if (!user && !EMAIL_REGEX.test(customerEmail)) {
    return { error: 'Enter a valid email address.' }
  }

  let models: Awaited<ReturnType<typeof uploadQuoteModels>> = []
  let quoteID: number | null = null
  let accessToken = ''

  try {
    models = await uploadQuoteModels({
      customerEmail,
      files,
      payload,
      user,
    })
    if (models.length !== files.length)
      throw new Error('Model uploads did not return all documents')

    const quote = await payload.create({
      collection: 'quotes',
      user,
      overrideAccess: !Boolean(user),
      data: {
        ...(user ? { customer: user.id } : { customerEmail }),
        status: 'new',
        items: models.map((model) => ({ model: model.id, quantity: 1 })),
      },
    })
    quoteID = quote.id
    accessToken = typeof quote.accessToken === 'string' ? quote.accessToken : ''
  } catch (error) {
    await cleanupUploadedModels(payload, models)

    payload.logger.error({ error }, 'Failed to start quote')
    return { error: 'We could not create your draft quote. Please try again.' }
  }

  if (!quoteID) return { error: 'We could not create your draft quote. Please try again.' }

  const query = !user
    ? `?email=${encodeURIComponent(customerEmail)}&accessToken=${encodeURIComponent(accessToken)}`
    : ''
  redirect(`/quotes/${quoteID}${query}`)
}

export default function NewQuotePage() {
  return <QuoteWizard startQuoteAction={startQuoteAction} />
}

export const metadata: Metadata = {
  description: 'Start a guided quote request for your 3D print.',
  openGraph: mergeOpenGraph({
    title: 'New Quote',
    url: '/quotes/new',
  }),
  title: 'New Quote',
}
