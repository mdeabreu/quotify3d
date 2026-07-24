import type { Payload } from 'payload'

import type { QuoteWorkspaceItem } from '@/components/QuoteDetailsWorkspace/types'
import { analyzeQuoteItemConfiguration } from '@/lib/quotes/quoteItemConfiguration'
import {
  buildAvailableSpoolOptions,
  getCatalogImageRendition,
  uniqueOptions,
  type AvailableProcessOption,
  type CatalogImage,
} from '@/lib/spoolAvailability'
import type { Quote, User } from '@/payload-types'
import { resolveRelationID } from '@/utilities/resolveRelationID'

type ProcessDocument = {
  description?: string | null
  id: number
  image?: CatalogImage | number | null
  name: string
}

const normalizeProcessOption = (option: ProcessDocument): AvailableProcessOption => ({
  description: typeof option.description === 'string' ? option.description : null,
  ...getCatalogImageRendition(option.image),
  id: option.id,
  kind: 'process',
  name: option.name,
})

const numericRelationID = (value: unknown): number | null => {
  const id = resolveRelationID(value)
  return typeof id === 'number' ? id : null
}

export const buildQuoteWorkspaceViewModel = async ({
  accessToken,
  email,
  payload,
  quote,
  user,
}: {
  accessToken: string
  email: string
  payload: Payload
  quote: Quote
  user: User | null
}) => {
  const activeQuery = {
    pagination: false,
    sort: 'name',
    where: { active: { equals: true } },
  } as const

  const [spoolsResult, processesResult, relatedProductsResult] = await Promise.all([
    payload.find({
      collection: 'spools',
      depth: 2,
      limit: 500,
      overrideAccess: true,
      ...activeQuery,
      sort: 'id',
    }),
    payload.find({
      collection: 'processes',
      depth: 1,
      limit: 200,
      overrideAccess: true,
      ...activeQuery,
    }),
    quote.items.length > 0
      ? payload.find({
          collection: 'products',
          depth: 0,
          limit: quote.items.length * 2,
          pagination: false,
          user,
          overrideAccess: false,
          where: { quote: { equals: quote.id } },
          select: { id: true, quoteItemID: true, slug: true },
        })
      : Promise.resolve(null),
  ])

  const spoolOptions = buildAvailableSpoolOptions(spoolsResult.docs)
  const materialOptions = uniqueOptions(spoolOptions, 'filament')
  const colourOptions = uniqueOptions(spoolOptions, 'colour')
  const qualityOptions = (processesResult.docs as ProcessDocument[]).map(normalizeProcessOption)
  const productByQuoteItemID = new Map<string, { id: number; slug?: string | null }>()

  for (const product of relatedProductsResult?.docs ?? []) {
    if (typeof product.quoteItemID !== 'string' || productByQuoteItemID.has(product.quoteItemID)) {
      continue
    }
    productByQuoteItemID.set(product.quoteItemID, { id: product.id, slug: product.slug })
  }

  const items: QuoteWorkspaceItem[] = await Promise.all(
    quote.items.map(async (item, index) => {
      const analysis = await analyzeQuoteItemConfiguration({ item, payload })
      const hasLinkedEstimate = analysis.complete && numericRelationID(item.gcode) !== null
      const itemID = item.id ?? `${quote.id}-${index}`
      const model = typeof item.model === 'object' ? item.model : null
      const modelQuery = new URLSearchParams()
      if (email) modelQuery.set('email', email)
      if (accessToken) modelQuery.set('accessToken', accessToken)
      const product = item.id ? productByQuoteItemID.get(item.id) : undefined
      const filamentSlots = Array.from({ length: analysis.slotCount }, (_, slotIndex) => {
        const slot = item.filamentSlots?.[slotIndex]
        const colourID = analysis.slotColourIDs[slotIndex]
        const available = colourOptions.find((option) => option.id === colourID)
        const saved = typeof slot?.colour === 'object' ? slot.colour : null
        return {
          colourId: colourID ? String(colourID) : '',
          colourLabel: colourID ? saved?.name || available?.name || `Colour ${colourID}` : '',
          description:
            typeof slot?.description === 'string' && slot.description.trim()
              ? slot.description.trim()
              : '',
          hex: available?.swatches[0] ?? '#808080',
        }
      })

      return {
        configurationIssues: analysis.issues,
        configured: analysis.complete,
        filamentId: String(numericRelationID(item.filament) ?? ''),
        filamentLabel:
          typeof item.filament === 'object' && item.filament?.name ? item.filament.name : '',
        filamentSlots,
        gcodeDuration:
          hasLinkedEstimate && typeof item.gcodeDuration === 'number' ? item.gcodeDuration : null,
        gcodePrice:
          hasLinkedEstimate && typeof item.gcodePrice === 'number' ? item.gcodePrice : null,
        gcodeStatus:
          hasLinkedEstimate && typeof item.gcodeStatus === 'string' ? item.gcodeStatus : null,
        gcodeWeight:
          hasLinkedEstimate && typeof item.gcodeWeight === 'number' ? item.gcodeWeight : null,
        id: itemID,
        modelLabel: model?.originalFilename || `Model ${index + 1}`,
        modelNote: typeof item.notes === 'string' ? item.notes : '',
        modelSize: model?.filesize ?? undefined,
        modelSlotCount: analysis.slotCount,
        modelURL: `/quotes/${quote.id}/items/${encodeURIComponent(itemID)}/model${modelQuery.size ? `?${modelQuery.toString()}` : ''}`,
        processId: String(numericRelationID(item.process) ?? ''),
        processLabel:
          typeof item.process === 'object' && item.process?.name ? item.process.name : '',
        productID: product?.id,
        productSlug: product?.slug ?? undefined,
        quantity: item.quantity,
      }
    }),
  )

  return {
    addableItems: items.flatMap((item) =>
      typeof item.productID === 'number'
        ? [{ productID: item.productID, quantity: item.quantity }]
        : [],
    ),
    hasPendingLineItemPrice: items.some((item) => item.gcodePrice === null),
    items,
    materialOptions,
    qualityOptions,
    spoolOptions,
  }
}
