import type { Metadata } from 'next'
import type { Quote, QuoteStatus } from '@/payload-types'

import { QuoteDetailsWorkspace } from '@/components/QuoteDetailsWorkspace'
import { Price } from '@/components/Price'
import { AddAllQuoteItemsToCartButton } from '@/components/QuoteActions/AddAllQuoteItemsToCartButton'
import { QuoteStatus as QuoteStatusBadge } from '@/components/QuoteStatus'
import { Button } from '@/components/ui/button'
import { formatDateTime } from '@/utilities/formatDateTime'
import { getVisibleAdminNotes } from '@/utilities/quotes/getVisibleAdminNotes'
import {
  buildAvailableSpoolOptions,
  findSpoolForPair,
  getCatalogImageRendition,
  uniqueOptions,
  type AvailableProcessOption,
  type CatalogImage,
} from '@/lib/spoolAvailability'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import { resolveRelationID } from '@/utilities/resolveRelationID'
import { findAccessibleQuote } from '@/lib/quotes/findAccessibleQuote'
import { ChevronLeftIcon } from 'lucide-react'
import configPromise from '@payload-config'
import { headers as getHeaders } from 'next/headers'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ email?: string; accessToken?: string; item?: string }>
}

type QuoteOptionResponse = {
  id: number
  name: string
  description?: string | null
  image?: CatalogImage | number | null
}

const editableStatuses = new Set<QuoteStatus>(['new', 'queued', 'sliced'])

const normalizeProcessOption = (option: QuoteOptionResponse): AvailableProcessOption => {
  return {
    description: typeof option.description === 'string' ? option.description : null,
    ...getCatalogImageRendition(option.image),
    id: option.id,
    kind: 'process',
    name: option.name,
  }
}

const toNumericRelationID = (value: unknown): number | null => {
  const relationID = resolveRelationID(value)
  return typeof relationID === 'number' ? relationID : null
}

const serializeQuoteItem = (item: Quote['items'][number]) => {
  const model = toNumericRelationID(item.model)
  const spool = toNumericRelationID(item.spool)
  const filament = toNumericRelationID(item.filament)
  const colour = toNumericRelationID(item.colour)
  const process = toNumericRelationID(item.process)

  if (!model) return null

  return {
    id: item.id ?? undefined,
    model,
    quantity: item.quantity,
    ...(spool ? { spool } : {}),
    ...(filament ? { filament } : {}),
    ...(colour ? { colour } : {}),
    filamentSlots: Array.isArray(item.filamentSlots)
      ? item.filamentSlots.map((slot) => {
          const slotColour = toNumericRelationID(slot?.colour)
          return {
            ...(slotColour ? { colour: slotColour } : {}),
            ...(typeof slot.description === 'string' && slot.description.trim()
              ? { description: slot.description.trim() }
              : {}),
          }
        })
      : undefined,
    ...(typeof item.notes === 'string' && item.notes.trim() ? { notes: item.notes.trim() } : {}),
    ...(process ? { process } : {}),
    machine: toNumericRelationID(item.machine) ?? undefined,
    gcode: toNumericRelationID(item.gcode) ?? undefined,
  }
}

const getQuotePath = (
  quoteID: number,
  customerEmail: string,
  accessToken: string,
  selectedItemID?: string,
) => {
  const queryParams = new URLSearchParams()

  if (customerEmail) {
    queryParams.set('email', customerEmail)
  }

  if (accessToken) {
    queryParams.set('accessToken', accessToken)
  }

  if (selectedItemID) {
    queryParams.set('item', selectedItemID)
  }

  const queryString = queryParams.toString()

  return `/quotes/${quoteID}${queryString ? `?${queryString}` : ''}`
}

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

export default async function QuotePage({ params, searchParams }: PageProps) {
  const headers = await getHeaders()
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers })

  const { id } = await params
  const { email = '', accessToken = '', item: selectedItemID = '' } = await searchParams

  const quote = await findAccessibleQuote({
    accessToken,
    customerEmail: email,
    payload,
    quoteID: id,
    user,
  }).catch((error) => {
    console.error(error)
    return null
  })

  if (!quote) {
    notFound()
  }

  const editable = isEditableQuoteStatus(quote.status)
  const readOnlyMessage = !editable ? getReadOnlyQuoteMessage(quote.status) : null
  const visibleAdminNotes = getVisibleAdminNotes(quote)

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

  const spoolQuery = {
    depth: 2,
    limit: 500,
    pagination: false,
    sort: 'id',
    where: {
      active: {
        equals: true,
      },
    },
  } as const

  const [spoolsResult, processesResult] = await Promise.all([
    payload.find({
      collection: 'spools',
      overrideAccess: true,
      ...spoolQuery,
    }),
    payload.find({
      collection: 'processes',
      overrideAccess: true,
      ...optionQuery,
    }),
  ])

  const spoolOptions = buildAvailableSpoolOptions(spoolsResult.docs)
  const materialOptions = uniqueOptions(spoolOptions, 'filament')
  const colourOptions = uniqueOptions(spoolOptions, 'colour')
  const qualityOptions = (processesResult.docs as QuoteOptionResponse[]).map(normalizeProcessOption)

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
      typeof item.id === 'string' && item.id.length > 0
        ? productByQuoteItemID.get(item.id)
        : undefined

    const itemID = item.id ?? `${quote.id}-${index}`
    const model = typeof item.model === 'object' ? item.model : null
    const modelSlotCount = Math.max(1, Math.floor(model?.filamentSlotCount || 1))
    const filamentSlots = Array.isArray(item.filamentSlots)
      ? item.filamentSlots.map((slot) => {
          const colourID = resolveRelationID(slot?.colour)
          const option = colourOptions.find((candidate) => candidate.id === colourID)
          const colour = typeof slot.colour === 'object' ? slot.colour : null
          return {
            colourId: colourID ? String(colourID) : '',
            colourLabel: colourID ? colour?.name || option?.name || `Colour ${colourID}` : '',
            description:
              typeof slot.description === 'string' && slot.description.trim()
                ? slot.description.trim()
                : '',
            hex: option?.swatches[0] ?? '#808080',
          }
        })
      : []
    const configured = Boolean(
      resolveRelationID(item.filament) &&
      resolveRelationID(item.process) &&
      resolveRelationID(item.machine) &&
      filamentSlots.length === modelSlotCount &&
      filamentSlots.every((slot) => slot.colourId),
    )
    const modelQuery = new URLSearchParams()
    if (email) modelQuery.set('email', email)
    if (accessToken) modelQuery.set('accessToken', accessToken)

    return {
      id: itemID,
      modelLabel: model?.originalFilename || `Model ${index + 1}`,
      modelSize: model?.filesize ?? undefined,
      modelSlotCount,
      modelURL: `/quotes/${quote.id}/items/${encodeURIComponent(itemID)}/model${modelQuery.size ? `?${modelQuery.toString()}` : ''}`,
      quantity: item.quantity,
      filamentId: String(resolveRelationID(item.filament) ?? ''),
      filamentLabel:
        typeof item.filament === 'object' && item.filament?.name ? item.filament.name : '',
      filamentSlots,
      modelNote: typeof item.notes === 'string' ? item.notes : '',
      processId: String(resolveRelationID(item.process) ?? ''),
      processLabel: typeof item.process === 'object' && item.process?.name ? item.process.name : '',
      configured,
      gcodeDuration:
        configured && typeof item.gcodeDuration === 'number' ? item.gcodeDuration : null,
      gcodePrice: configured && typeof item.gcodePrice === 'number' ? item.gcodePrice : null,
      gcodeStatus: typeof item.gcodeStatus === 'string' ? item.gcodeStatus : null,
      gcodeWeight: configured && typeof item.gcodeWeight === 'number' ? item.gcodeWeight : null,
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

  const saveItemAction = async (formData: FormData) => {
    'use server'

    const payload = await getPayload({ config: configPromise })
    const headers = await getHeaders()
    const { user } = await payload.auth({ headers })

    const quoteID = Number.parseInt(String(formData.get('quoteID') ?? ''), 10)
    const itemID = String(formData.get('itemID') ?? '')
    const customerEmail = String(formData.get('email') ?? '')
      .trim()
      .toLowerCase()
    const accessToken = String(formData.get('accessToken') ?? '').trim()
    if (!Number.isInteger(quoteID) || quoteID < 1 || !itemID) {
      return { error: 'Invalid quote item.', success: false as const }
    }

    const accessibleQuote = await findAccessibleQuote({
      accessToken,
      customerEmail,
      payload,
      quoteID,
      user,
    })

    if (!accessibleQuote || !isEditableQuoteStatus(accessibleQuote.status)) {
      return { error: 'This quote can no longer be edited.', success: false as const }
    }

    const selectedItem = accessibleQuote.items.find((item) => item.id === itemID)
    const model = typeof selectedItem?.model === 'object' ? selectedItem.model : null
    const slotCount = Math.max(1, Math.floor(model?.filamentSlotCount || 1))
    if (!selectedItem || !model) {
      return { error: 'The selected model could not be found.', success: false as const }
    }

    const filamentValue = String(formData.get('filament') ?? '')
    const processValue = String(formData.get('process') ?? '')
    const filament = filamentValue ? Number.parseInt(filamentValue, 10) : null
    const process = processValue ? Number.parseInt(processValue, 10) : null
    const quantity = Number.parseInt(String(formData.get('quantity') ?? ''), 10)
    const notes = String(formData.get('notes') ?? '').trim()

    if (
      (filament !== null &&
        (!Number.isInteger(filament) ||
          !materialOptions.some((option) => option.id === filament))) ||
      (process !== null &&
        (!Number.isInteger(process) || !qualityOptions.some((option) => option.id === process))) ||
      !Number.isInteger(quantity) ||
      quantity < 1
    ) {
      return { error: 'One or more model selections are invalid.', success: false as const }
    }

    let slots: Array<{ colour?: number; description?: string }>
    try {
      const parsed = JSON.parse(String(formData.get('filamentSlots') ?? '[]'))
      slots = Array.isArray(parsed)
        ? parsed.map((slot) => {
            const colour = Number.parseInt(String(slot?.colour ?? ''), 10)
            const description = typeof slot?.description === 'string' ? slot.description.trim() : ''
            return {
              ...(Number.isInteger(colour) ? { colour } : {}),
              ...(description ? { description } : {}),
            }
          })
        : []
    } catch {
      return { error: 'The colour assignments could not be read.', success: false as const }
    }

    if (slots.length !== slotCount) {
      return { error: 'The colour assignments do not match this model.', success: false as const }
    }

    if (
      slots.some(
        (slot) =>
          slot.colour &&
          (!filament || !findSpoolForPair(spoolOptions, { colour: slot.colour, filament })),
      )
    ) {
      return {
        error: 'A selected colour is not available for this material.',
        success: false as const,
      }
    }

    const assignedColours = slots.flatMap((slot) => (slot.colour ? [slot.colour] : []))
    if (
      assignedColours.length === slotCount &&
      assignedColours.every((colour) => colour === assignedColours[0])
    ) {
      slots = slots.map((slot) => ({ colour: slot.colour }))
    }

    const firstColour = slots[0]?.colour ?? null
    const firstSpool =
      filament && firstColour
        ? findSpoolForPair(spoolOptions, { colour: firstColour, filament })
        : null
    const currentConfiguration = JSON.stringify({
      filament: toNumericRelationID(selectedItem.filament),
      process: toNumericRelationID(selectedItem.process),
      slots: Array.isArray(selectedItem.filamentSlots)
        ? selectedItem.filamentSlots.map((slot) => toNumericRelationID(slot?.colour))
        : [],
    })
    const nextConfiguration = JSON.stringify({
      filament,
      process,
      slots: slots.map((slot) => slot.colour ?? null),
    })
    const configurationChanged = currentConfiguration !== nextConfiguration
    let nextItem: Record<string, unknown> | null = null

    const nextItems = accessibleQuote.items
      .map((item) => {
        const serializedItem = serializeQuoteItem(item)
        if (!serializedItem) return null
        if (item.id !== itemID) return serializedItem

        const updated: Record<string, unknown> = {
          ...serializedItem,
          filamentSlots: slots,
          quantity,
        }
        if (filament) updated.filament = filament
        else delete updated.filament
        if (process) updated.process = process
        else delete updated.process
        if (firstColour && firstSpool) {
          updated.colour = firstColour
          updated.spool = firstSpool.id
        } else {
          delete updated.colour
          delete updated.spool
        }
        if (notes) updated.notes = notes
        else delete updated.notes

        nextItem = updated
        return updated
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))

    const resolvedNextItem = nextItem as Record<string, unknown> | null
    if (!resolvedNextItem || nextItems.length !== accessibleQuote.items.length) {
      return { error: 'The model could not be updated.', success: false as const }
    }
    const resolvedSlots = Array.isArray(resolvedNextItem.filamentSlots)
      ? resolvedNextItem.filamentSlots
      : []
    const configured = Boolean(
      resolvedNextItem.model &&
      resolvedNextItem.filament &&
      resolvedNextItem.process &&
      resolvedNextItem.machine &&
      resolvedSlots.length === slotCount &&
      resolvedSlots.every((slot: { colour?: unknown }) => resolveRelationID(slot?.colour)),
    )
    const shouldQueue = configured && (configurationChanged || accessibleQuote.status === 'new')
    const data = {
      items: nextItems,
      ...(!configured
        ? { status: 'new' as const }
        : shouldQueue
          ? { status: 'queued' as const }
          : {}),
    }

    if (user) {
      await payload.update({
        collection: 'quotes',
        id: quoteID,
        user,
        overrideAccess: false,
        data,
      })
    } else {
      await payload.update({
        collection: 'quotes',
        id: quoteID,
        overrideAccess: true,
        data,
      })
    }

    return { success: true as const }
  }

  const removeItemAction = async (formData: FormData) => {
    'use server'

    const payload = await getPayload({ config: configPromise })
    const headers = await getHeaders()
    const { user } = await payload.auth({ headers })

    const quoteID = Number.parseInt(String(formData.get('quoteID') ?? ''), 10)
    const itemID = String(formData.get('itemID') ?? '')
    const customerEmail = String(formData.get('email') ?? '')
      .trim()
      .toLowerCase()
    const accessToken = String(formData.get('accessToken') ?? '').trim()

    if (!Number.isInteger(quoteID) || quoteID < 1 || !itemID) return

    const accessibleQuote = await findAccessibleQuote({
      accessToken,
      customerEmail,
      payload,
      quoteID,
      user,
    })

    if (!accessibleQuote || !isEditableQuoteStatus(accessibleQuote.status)) return
    if (accessibleQuote.items.length <= 1) return

    const removedIndex = accessibleQuote.items.findIndex((item) => item.id === itemID)

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

    const fallbackIndex = Math.min(Math.max(removedIndex, 0), nextItems.length - 1)
    redirect(getQuotePath(quoteID, customerEmail, accessToken, nextItems[fallbackIndex]?.id))
  }

  const addModelsAction = async (formData: FormData) => {
    'use server'

    const payload = await getPayload({ config: configPromise })
    const headers = await getHeaders()
    const { user } = await payload.auth({ headers })

    const quoteID = Number.parseInt(String(formData.get('quoteID') ?? ''), 10)
    const customerEmail = String(formData.get('email') ?? '')
      .trim()
      .toLowerCase()
    const accessToken = String(formData.get('accessToken') ?? '').trim()
    if (!Number.isInteger(quoteID) || quoteID < 1) return

    const accessibleQuote = await findAccessibleQuote({
      accessToken,
      customerEmail,
      payload,
      quoteID,
      user,
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
    }))

    const updatedQuote = user
      ? await payload.update({
          collection: 'quotes',
          id: quoteID,
          user,
          overrideAccess: false,
          data: {
            items: [...existingItems, ...newItems],
            status: 'new',
          },
        })
      : await payload.update({
          collection: 'quotes',
          id: quoteID,
          overrideAccess: true,
          data: {
            items: [...existingItems, ...newItems],
            status: 'new',
          },
        })

    redirect(
      getQuotePath(quoteID, customerEmail, accessToken, updatedQuote.items.at(-1)?.id ?? undefined),
    )
  }

  const submitForReviewAction = async (formData: FormData) => {
    'use server'

    const payload = await getPayload({ config: configPromise })
    const headers = await getHeaders()
    const { user } = await payload.auth({ headers })

    const quoteID = Number.parseInt(String(formData.get('quoteID') ?? ''), 10)
    const customerEmail = String(formData.get('email') ?? '')
      .trim()
      .toLowerCase()
    const accessToken = String(formData.get('accessToken') ?? '').trim()
    const notes = String(formData.get('notes') ?? '').trim()

    if (!Number.isInteger(quoteID) || quoteID < 1) return

    const accessibleQuote = await findAccessibleQuote({
      accessToken,
      customerEmail,
      payload,
      quoteID,
      user,
    })

    if (!accessibleQuote || !isEditableQuoteStatus(accessibleQuote.status)) return

    if (user) {
      await payload.update({
        collection: 'quotes',
        id: quoteID,
        user,
        overrideAccess: false,
        data: {
          notes: notes || null,
          status: 'ready-for-review',
        },
      })
    } else {
      await payload.update({
        collection: 'quotes',
        id: quoteID,
        overrideAccess: true,
        data: {
          notes: notes || null,
          status: 'ready-for-review',
        },
      })
    }

    redirect(getQuotePath(quoteID, customerEmail, accessToken))
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
            {visibleAdminNotes ? (
              <div className="mt-3 border-l-2 border-primary/20 pl-3">
                <p className="text-xs font-mono uppercase text-primary/50">A note from our team</p>
                <p className="mt-1 whitespace-pre-wrap">{visibleAdminNotes}</p>
              </div>
            ) : null}
          </div>
        ) : null}

        <div>
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-sm font-mono uppercase text-primary/50">Items</h2>
            <AddAllQuoteItemsToCartButton items={addableItems} />
          </div>

          <QuoteDetailsWorkspace
            addModelsAction={addModelsAction}
            currencyCode={quote.currency ?? undefined}
            editable={editable}
            email={email}
            accessToken={accessToken}
            initialItemID={selectedItemID}
            items={workspaceItems}
            materialOptions={materialOptions}
            qualityOptions={qualityOptions}
            quoteID={quote.id}
            quoteNotes={quote.notes}
            quoteStatus={quote.status}
            removeItemAction={removeItemAction}
            saveItemAction={saveItemAction}
            submitForReviewAction={submitForReviewAction}
            spoolOptions={spoolOptions}
          />
        </div>

        {!editable && quote.notes ? (
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
