import type { Metadata } from 'next'
import type { Quote, QuoteStatus } from '@/payload-types'

import { QuoteDetailsWorkspace } from '@/components/QuoteDetailsWorkspace'
import { Price } from '@/components/Price'
import { AddAllQuoteItemsToCartButton } from '@/components/QuoteActions/AddAllQuoteItemsToCartButton'
import { QuoteStatus as QuoteStatusBadge } from '@/components/QuoteStatus'
import { Button } from '@/components/ui/button'
import { formatDateTime } from '@/utilities/formatDateTime'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import { resolveRelationID } from '@/utilities/resolveRelationID'
import { ChevronLeftIcon } from 'lucide-react'
import configPromise from '@payload-config'
import { headers as getHeaders } from 'next/headers'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ email?: string }>
}

type QuoteOptionResponse = {
  id: number
  name: string
  description?: string | null
  image?:
    | {
        url?: string | null
        thumbnailURL?: string | null
      }
    | number
    | null
}

type QuoteOption = {
  id: number
  name: string
  description: string | null
  imageUrl: string | null
}

const editableStatuses = new Set<QuoteStatus>(['new', 'queued', 'sliced'])

const toAbsoluteURL = (value: string): string => {
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value
  }

  const base = process.env.NEXT_PUBLIC_SERVER_URL ?? ''
  if (!base) return value

  return `${base}${value}`
}

const normalizeOption = (option: QuoteOptionResponse): QuoteOption => {
  let imageUrl: string | null = null

  if (option.image && typeof option.image === 'object') {
    const candidate = option.image.thumbnailURL || option.image.url

    if (typeof candidate === 'string' && candidate.length > 0) {
      imageUrl = toAbsoluteURL(candidate)
    }
  }

  return {
    id: option.id,
    name: option.name,
    description: typeof option.description === 'string' ? option.description : null,
    imageUrl,
  }
}

const toNumericRelationID = (value: unknown): number | null => {
  const relationID = resolveRelationID(value)
  return typeof relationID === 'number' ? relationID : null
}

const serializeQuoteItem = (item: Quote['items'][number]) => {
  const model = toNumericRelationID(item.model)
  const filament = toNumericRelationID(item.filament)
  const colour = toNumericRelationID(item.colour)
  const process = toNumericRelationID(item.process)

  if (!model || !filament || !colour || !process) {
    return null
  }

  return {
    id: item.id ?? undefined,
    model,
    quantity: item.quantity,
    filament,
    colour,
    process,
    machine: toNumericRelationID(item.machine) ?? undefined,
    gcode: toNumericRelationID(item.gcode) ?? undefined,
  }
}

const getQuotePath = (quoteID: number, customerEmail: string) =>
  `/quotes/${quoteID}${customerEmail ? `?email=${encodeURIComponent(customerEmail)}` : ''}`

const isEditableQuoteStatus = (status: QuoteStatus) => editableStatuses.has(status)

const getReadOnlyQuoteMessage = (status: QuoteStatus) => {
  switch (status) {
    case 'ready-for-review':
      return {
        title: 'Your quote is waiting for review.',
        body: 'We have everything we need and will take a look shortly. Once reviewed, we will approve it or follow up if anything needs attention.',
      }
    case 'in-review':
      return {
        title: 'We are reviewing your quote.',
        body: 'Our team is checking the files and pricing now. We will update this quote as soon as the review is complete.',
      }
    case 'approved':
      return {
        title: 'Your quote has been approved.',
        body: 'Everything is ready on our side. You can review the items below and continue when you are ready.',
      }
    case 'rejected':
      return {
        title: 'This quote needs an update before it can move forward.',
        body: 'We were not able to approve this quote as submitted. Review the details below and contact us if you need help with the next step.',
      }
    default:
      return {
        title: 'This quote is currently read-only.',
        body: 'You can review the details below while we finish processing it.',
      }
  }
}

const findAccessibleQuote = async ({
  customerEmail,
  payloadInstance,
  quoteID,
  quoteUser,
}: {
  customerEmail: string
  payloadInstance: Awaited<ReturnType<typeof getPayload>>
  quoteID: number | string
  quoteUser: Awaited<ReturnType<Awaited<ReturnType<typeof getPayload>>['auth']>>['user']
}) => {
  const {
    docs: [quoteResult],
  } = await payloadInstance.find({
    collection: 'quotes',
    user: quoteUser,
    overrideAccess: !Boolean(quoteUser),
    depth: 2,
    where: {
      and: [
        {
          id: {
            equals: quoteID,
          },
        },
        ...(quoteUser
          ? [
              {
                customer: {
                  equals: quoteUser.id,
                },
              },
            ]
          : []),
        ...(!quoteUser && customerEmail
          ? [
              {
                customerEmail: {
                  equals: customerEmail,
                },
              },
            ]
          : []),
      ],
    },
    select: {
      id: true,
      subtotal: true,
      currency: true,
      items: true,
      customerEmail: true,
      customer: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      notes: true,
    },
  })

  return quoteResult ?? null
}

export default async function QuotePage({ params, searchParams }: PageProps) {
  const headers = await getHeaders()
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers })

  const { id } = await params
  const { email = '' } = await searchParams

  const quote = await findAccessibleQuote({
    customerEmail: email,
    payloadInstance: payload,
    quoteID: id,
    quoteUser: user,
  }).catch((error) => {
    console.error(error)
    return null
  })

  if (!quote) {
    notFound()
  }

  const editable = isEditableQuoteStatus(quote.status)
  const readOnlyMessage = !editable ? getReadOnlyQuoteMessage(quote.status) : null

  const optionQuery = {
    depth: 1,
    limit: 200,
    pagination: false,
    sort: 'name',
    where: {
      active: {
        equals: true,
      },
    },
  } as const

  const [filamentsResult, coloursResult, processesResult] = await Promise.all([
    payload.find({
      collection: 'filaments',
      overrideAccess: true,
      ...optionQuery,
    }),
    payload.find({
      collection: 'colours',
      overrideAccess: true,
      ...optionQuery,
    }),
    payload.find({
      collection: 'processes',
      overrideAccess: true,
      ...optionQuery,
    }),
  ])

  const materialOptions = (filamentsResult.docs as QuoteOptionResponse[]).map(normalizeOption)
  const colourOptions = (coloursResult.docs as QuoteOptionResponse[]).map(normalizeOption)
  const qualityOptions = (processesResult.docs as QuoteOptionResponse[]).map(normalizeOption)

  const relatedProductsResult =
    quote.items.length > 0
      ? await payload.find({
          collection: 'products',
          depth: 0,
          limit: quote.items.length * 2,
          pagination: false,
          user,
          overrideAccess: false,
          where: {
            quote: {
              equals: quote.id,
            },
          },
          select: {
            id: true,
            slug: true,
            quoteItemID: true,
          },
        })
      : null

  const productByQuoteItemID = new Map<string, { id: number; slug?: string | null }>()

  if (relatedProductsResult?.docs?.length) {
    for (const product of relatedProductsResult.docs) {
      if (typeof product.quoteItemID !== 'string' || product.quoteItemID.length === 0) continue

      if (!productByQuoteItemID.has(product.quoteItemID)) {
        productByQuoteItemID.set(product.quoteItemID, { id: product.id, slug: product.slug })
      }
    }
  }

  const workspaceItems = quote.items.map((item, index) => {
    const relatedProduct =
      typeof item.id === 'string' && item.id.length > 0 ? productByQuoteItemID.get(item.id) : undefined

    return {
      id: item.id ?? `${quote.id}-${index}`,
      modelLabel:
        typeof item.model === 'object' && item.model?.originalFilename
          ? item.model.originalFilename
          : `Model ${index + 1}`,
      quantity: item.quantity,
      filamentId: String(resolveRelationID(item.filament) ?? ''),
      filamentLabel:
        typeof item.filament === 'object' && item.filament?.name ? item.filament.name : 'Material',
      colourId: String(resolveRelationID(item.colour) ?? ''),
      colourLabel: typeof item.colour === 'object' && item.colour?.name ? item.colour.name : 'Colour',
      processId: String(resolveRelationID(item.process) ?? ''),
      processLabel:
        typeof item.process === 'object' && item.process?.name ? item.process.name : 'Quality',
      gcodePrice: typeof item.gcodePrice === 'number' ? item.gcodePrice : null,
      gcodeStatus: typeof item.gcodeStatus === 'string' ? item.gcodeStatus : null,
      productID: relatedProduct?.id,
      productSlug: relatedProduct?.slug ?? undefined,
    }
  })

  const addableItems = workspaceItems.reduce<Array<{ productID: number; quantity: number }>>(
    (acc, item) => {
      if (typeof item.productID !== 'number') return acc

      acc.push({
        productID: item.productID,
        quantity: item.quantity,
      })

      return acc
    },
    [],
  )

  const hasPendingLineItemPrice = workspaceItems.some((item) => item.gcodePrice === null)

  const updatePriceAction = async (formData: FormData) => {
    'use server'

    const payload = await getPayload({ config: configPromise })
    const headers = await getHeaders()
    const { user } = await payload.auth({ headers })

    const quoteID = Number.parseInt(String(formData.get('quoteID') ?? ''), 10)
    const customerEmail = String(formData.get('email') ?? '').trim().toLowerCase()

    if (!Number.isInteger(quoteID) || quoteID < 1) return

    const accessibleQuote = await findAccessibleQuote({
      customerEmail,
      payloadInstance: payload,
      quoteID,
      quoteUser: user,
    })

    if (!accessibleQuote || !isEditableQuoteStatus(accessibleQuote.status)) return

    if (user) {
      await payload.update({
        collection: 'quotes',
        id: quoteID,
        user,
        overrideAccess: false,
        data: {
          status: 'queued',
        },
      })
    } else {
      await payload.update({
        collection: 'quotes',
        id: quoteID,
        overrideAccess: true,
        data: {
          status: 'queued',
        },
      })
    }

    redirect(getQuotePath(quoteID, customerEmail))
  }

  const saveItemAction = async (formData: FormData) => {
    'use server'

    const payload = await getPayload({ config: configPromise })
    const headers = await getHeaders()
    const { user } = await payload.auth({ headers })

    const quoteID = Number.parseInt(String(formData.get('quoteID') ?? ''), 10)
    const itemID = String(formData.get('itemID') ?? '')
    const customerEmail = String(formData.get('email') ?? '').trim().toLowerCase()
    const quantity = Number.parseInt(String(formData.get('quantity') ?? ''), 10)
    const filament = Number.parseInt(String(formData.get('filament') ?? ''), 10)
    const colour = Number.parseInt(String(formData.get('colour') ?? ''), 10)
    const process = Number.parseInt(String(formData.get('process') ?? ''), 10)

    if (
      !Number.isInteger(quoteID) ||
      quoteID < 1 ||
      !itemID ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      !Number.isInteger(filament) ||
      !Number.isInteger(colour) ||
      !Number.isInteger(process)
    ) {
      return
    }

    const accessibleQuote = await findAccessibleQuote({
      customerEmail,
      payloadInstance: payload,
      quoteID,
      quoteUser: user,
    })

    if (!accessibleQuote || !isEditableQuoteStatus(accessibleQuote.status)) return

    const nextItems = accessibleQuote.items
      .map((item) => {
        const serializedItem = serializeQuoteItem(item)
        if (!serializedItem) return null

        if (item.id !== itemID) {
          return serializedItem
        }

        return {
          ...serializedItem,
          quantity,
          filament,
          colour,
          process,
        }
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))

    if (user) {
      await payload.update({
        collection: 'quotes',
        id: quoteID,
        user,
        overrideAccess: false,
        data: {
          items: nextItems,
        },
      })
    } else {
      await payload.update({
        collection: 'quotes',
        id: quoteID,
        overrideAccess: true,
        data: {
          items: nextItems,
        },
      })
    }

    redirect(getQuotePath(quoteID, customerEmail))
  }

  const removeItemAction = async (formData: FormData) => {
    'use server'

    const payload = await getPayload({ config: configPromise })
    const headers = await getHeaders()
    const { user } = await payload.auth({ headers })

    const quoteID = Number.parseInt(String(formData.get('quoteID') ?? ''), 10)
    const itemID = String(formData.get('itemID') ?? '')
    const customerEmail = String(formData.get('email') ?? '').trim().toLowerCase()

    if (!Number.isInteger(quoteID) || quoteID < 1 || !itemID) return

    const accessibleQuote = await findAccessibleQuote({
      customerEmail,
      payloadInstance: payload,
      quoteID,
      quoteUser: user,
    })

    if (!accessibleQuote || !isEditableQuoteStatus(accessibleQuote.status)) return
    if (accessibleQuote.items.length <= 1) return

    const nextItems = accessibleQuote.items
      .filter((item) => item.id !== itemID)
      .map(serializeQuoteItem)
      .filter((item): item is NonNullable<typeof item> => Boolean(item))

    if (user) {
      await payload.update({
        collection: 'quotes',
        id: quoteID,
        user,
        overrideAccess: false,
        data: {
          items: nextItems,
        },
      })
    } else {
      await payload.update({
        collection: 'quotes',
        id: quoteID,
        overrideAccess: true,
        data: {
          items: nextItems,
        },
      })
    }

    redirect(getQuotePath(quoteID, customerEmail))
  }

  const addModelsAction = async (formData: FormData) => {
    'use server'

    const payload = await getPayload({ config: configPromise })
    const headers = await getHeaders()
    const { user } = await payload.auth({ headers })

    const quoteID = Number.parseInt(String(formData.get('quoteID') ?? ''), 10)
    const customerEmail = String(formData.get('email') ?? '').trim().toLowerCase()
    const filament =
      Number.parseInt(String(formData.get('filament') ?? ''), 10) || materialOptions[0]?.id
    const colour = Number.parseInt(String(formData.get('colour') ?? ''), 10) || colourOptions[0]?.id
    const process =
      Number.parseInt(String(formData.get('process') ?? ''), 10) || qualityOptions[0]?.id

    if (
      !Number.isInteger(quoteID) ||
      quoteID < 1 ||
      !Number.isInteger(filament) ||
      !Number.isInteger(colour) ||
      !Number.isInteger(process)
    ) {
      return
    }

    const accessibleQuote = await findAccessibleQuote({
      customerEmail,
      payloadInstance: payload,
      quoteID,
      quoteUser: user,
    })

    if (!accessibleQuote || !isEditableQuoteStatus(accessibleQuote.status)) return

    const files = formData
      .getAll('files')
      .filter((value): value is File => value instanceof File && value.size > 0)

    if (files.length === 0) return

    const createdModels = []

    for (const file of files) {
      const uploadFile = {
        name: file.name,
        data: Buffer.from(await file.arrayBuffer()),
        mimetype: file.type || 'application/octet-stream',
        size: file.size,
      }

      const createdModel = await payload.create({
        collection: 'models',
        file: uploadFile,
        user,
        overrideAccess: !Boolean(user),
        data: user ? {} : { customerEmail },
      })

      createdModels.push(createdModel)
    }

    const existingItems = accessibleQuote.items
      .map(serializeQuoteItem)
      .filter((item): item is NonNullable<typeof item> => Boolean(item))

    const newItems = createdModels.map((model) => ({
      model: model.id,
      quantity: 1,
      filament,
      colour,
      process,
    }))

    if (user) {
      await payload.update({
        collection: 'quotes',
        id: quoteID,
        user,
        overrideAccess: false,
        data: {
          items: [...existingItems, ...newItems],
        },
      })
    } else {
      await payload.update({
        collection: 'quotes',
        id: quoteID,
        overrideAccess: true,
        data: {
          items: [...existingItems, ...newItems],
        },
      })
    }

    redirect(getQuotePath(quoteID, customerEmail))
  }

  const submitForReviewAction = async (formData: FormData) => {
    'use server'

    const payload = await getPayload({ config: configPromise })
    const headers = await getHeaders()
    const { user } = await payload.auth({ headers })

    const quoteID = Number.parseInt(String(formData.get('quoteID') ?? ''), 10)
    const customerEmail = String(formData.get('email') ?? '').trim().toLowerCase()

    if (!Number.isInteger(quoteID) || quoteID < 1) return

    const accessibleQuote = await findAccessibleQuote({
      customerEmail,
      payloadInstance: payload,
      quoteID,
      quoteUser: user,
    })

    if (!accessibleQuote || !isEditableQuoteStatus(accessibleQuote.status)) return

    if (user) {
      await payload.update({
        collection: 'quotes',
        id: quoteID,
        user,
        overrideAccess: false,
        data: {
          status: 'ready-for-review',
        },
      })
    } else {
      await payload.update({
        collection: 'quotes',
        id: quoteID,
        overrideAccess: true,
        data: {
          status: 'ready-for-review',
        },
      })
    }

    redirect(getQuotePath(quoteID, customerEmail))
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-8">
        {user ? (
          <div className="flex gap-4">
            <Button asChild variant="ghost">
              <Link href="/quotes">
                <ChevronLeftIcon />
                All quotes
              </Link>
            </Button>
          </div>
        ) : (
          <div />
        )}

        <h1 className="rounded bg-primary/10 px-2 text-sm font-mono uppercase tracking-[0.07em]">
          <span>{`Quote #${quote.id}`}</span>
        </h1>
      </div>

      <div className="flex flex-col gap-10 rounded-lg border bg-card px-6 py-4">
        <div className="flex flex-col gap-6 lg:flex-row lg:justify-between">
          <div>
            <p className="mb-1 text-sm font-mono uppercase text-primary/50">Quote Date</p>
            <p className="text-lg">
              <time dateTime={quote.createdAt}>
                {formatDateTime({ date: quote.createdAt, format: 'MMMM dd, yyyy' })}
              </time>
            </p>
          </div>

          <div>
            <p
              className={
                hasPendingLineItemPrice
                  ? 'mb-1 text-sm font-mono uppercase text-primary/40'
                  : 'mb-1 text-sm font-mono uppercase text-primary/50'
              }
            >
              Total
            </p>
            {typeof quote.subtotal === 'number' ? (
              <Price
                amount={quote.subtotal}
                className={hasPendingLineItemPrice ? 'text-lg text-primary/55' : 'text-lg'}
                currencyCode={quote.currency ?? undefined}
              />
            ) : (
              <p className={hasPendingLineItemPrice ? 'text-primary/55' : 'text-primary/50'}>
                Pending
              </p>
            )}
          </div>

          {quote.status ? (
            <div className="grow max-w-1/3">
              <p className="mb-1 text-sm font-mono uppercase text-primary/50">Status</p>
              <QuoteStatusBadge className="text-sm" status={quote.status} />
            </div>
          ) : null}
        </div>

        {!editable ? (
          <div className="rounded-md border bg-background px-4 py-3 text-sm text-primary/70">
            <p className="font-medium text-primary">{readOnlyMessage?.title}</p>
            <p className="mt-1">{readOnlyMessage?.body}</p>
          </div>
        ) : null}

        <div>
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-sm font-mono uppercase text-primary/50">Items</h2>
            <AddAllQuoteItemsToCartButton items={addableItems} />
          </div>

          <QuoteDetailsWorkspace
            addModelsAction={addModelsAction}
            colourOptions={colourOptions}
            currencyCode={quote.currency ?? undefined}
            editable={editable}
            email={email}
            items={workspaceItems}
            materialOptions={materialOptions}
            qualityOptions={qualityOptions}
            quoteID={quote.id}
            refreshEstimatesAction={updatePriceAction}
            removeItemAction={removeItemAction}
            saveItemAction={saveItemAction}
            submitForReviewAction={submitForReviewAction}
          />
        </div>

        {quote.notes ? (
          <div>
            <h2 className="mb-4 text-sm font-mono uppercase text-primary/50">Notes</h2>
            <p className="whitespace-pre-wrap">{quote.notes}</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params

  return {
    description: `Quote details for quote ${id}.`,
    openGraph: mergeOpenGraph({
      title: `Quote ${id}`,
      url: `/quotes/${id}`,
    }),
    title: `Quote ${id}`,
  }
}
