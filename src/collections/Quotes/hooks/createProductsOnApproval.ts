import type { CollectionAfterChangeHook, RequiredDataFromCollectionSlug } from 'payload'

import { currenciesConfig } from '@/config/currencies'
import { resolveRelationID } from '@/utilities/resolveRelationID'

const formatDuration = (totalSeconds: number): string => {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const days = Math.floor(safeSeconds / 86400)
  const hours = Math.floor((safeSeconds % 86400) / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const seconds = safeSeconds % 60

  const parts: string[] = []
  if (days > 0) parts.push(`${days} day${days === 1 ? '' : 's'}`)
  if (hours > 0) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`)
  if (minutes > 0) parts.push(`${minutes} minute${minutes === 1 ? '' : 's'}`)
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds} second${seconds === 1 ? '' : 's'}`)

  return parts.join(', ')
}

const formatWeight = (grams: number): string => {
  const safeGrams = Math.max(0, grams)
  if (safeGrams >= 1000) {
    const kilograms = safeGrams / 1000
    return `${safeGrams.toFixed(1)} g (${kilograms.toFixed(2)} kg)`
  }

  return `${safeGrams.toFixed(1)} g`
}

const kebabCase = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const stripExtension = (filename: string): string => filename.replace(/\.[^.]+$/, '')

const toOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

const toOptionalNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined

const colourFinishLabel: Record<string, string> = {
  regular: 'Regular',
  matte: 'Matte',
  silk: 'Silk',
}

const colourTypeLabel: Record<string, string> = {
  solid: 'Solid',
  'co-extrusion': 'Co-extrusion',
  gradient: 'Gradient',
}

const textNode = (text: string) => ({
  type: 'text',
  version: 1 as const,
  detail: 0 as const,
  format: 0 as const,
  mode: 'normal' as const,
  style: '',
  text,
})

const paragraphNode = (text: string) => ({
  type: 'paragraph',
  version: 1 as const,
  direction: 'ltr' as const,
  format: '' as const,
  indent: 0 as const,
  textFormat: 0 as const,
  textStyle: '',
  children: [textNode(text)],
})

const buildDescription = ({
  quoteID,
  modelName,
  processName,
  filamentName,
  colourName,
  quantity,
  durationSeconds,
  weightGrams,
}: {
  quoteID: number
  modelName: string
  processName?: string
  filamentName?: string
  colourName?: string
  quantity?: number
  durationSeconds?: number
  weightGrams?: number
}) => {
  const durationText =
    typeof durationSeconds === 'number' ? formatDuration(durationSeconds) : 'Not available'
  const weightText = typeof weightGrams === 'number' ? formatWeight(weightGrams) : 'Not available'
  const materialText = filamentName ?? 'Not specified'
  const processText = processName ?? 'Not specified'
  const colourText = colourName ?? 'Not specified'
  const quantityText = typeof quantity === 'number' ? `${quantity}` : 'Not specified'

  return {
    root: {
      type: 'root',
      direction: 'ltr' as const,
      format: '' as const,
      indent: 0,
      version: 1,
      children: [
        {
          type: 'heading',
          tag: 'h3',
          version: 1 as const,
          direction: 'ltr' as const,
          format: '' as const,
          indent: 0 as const,
          children: [textNode('Print Configuration')],
        },
        paragraphNode(`Model: ${modelName}.`),
        paragraphNode(`Process: ${processText}.`),
        paragraphNode(`Material: ${materialText}.`),
        paragraphNode(`Colour: ${colourText}.`),
        paragraphNode(`Quantity requested: ${quantityText}.`),
        {
          type: 'heading',
          tag: 'h3',
          version: 1 as const,
          direction: 'ltr' as const,
          format: '' as const,
          indent: 0 as const,
          children: [textNode('Production Summary')],
        },
        paragraphNode(`Generated from approved quote #${quoteID}.`),
        paragraphNode(`Estimated print time: ${durationText}.`),
        paragraphNode(`Estimated filament weight: ${weightText}.`),
      ],
    },
  }
}

const getUniqueSlug = async ({
  req,
  slugBase,
}: {
  req: Parameters<CollectionAfterChangeHook>[0]['req']
  slugBase: string
}): Promise<string> => {
  let attempt = 0

  while (attempt < 50) {
    const candidate = attempt === 0 ? slugBase : `${slugBase}-${attempt + 1}`

    const existing = await req.payload.find({
      collection: 'products',
      depth: 0,
      limit: 1,
      pagination: false,
      req,
      overrideAccess: true,
      where: {
        slug: {
          equals: candidate,
        },
      },
    })

    if (existing.docs.length === 0) {
      return candidate
    }

    attempt += 1
  }

  throw new Error(`Unable to generate a unique product slug for base "${slugBase}"`)
}

export const createProductsOnApproval: CollectionAfterChangeHook = async ({
  doc,
  operation,
  previousDoc,
  req,
}) => {
  if (!doc) return doc

  const movedToApproved =
    doc.status === 'approved' && (operation === 'create' || previousDoc?.status !== 'approved')

  if (!movedToApproved || !Array.isArray(doc.items) || doc.items.length === 0) {
    return doc
  }

  const defaultCurrencyCode = currenciesConfig.defaultCurrency.toUpperCase()
  const priceField = `priceIn${defaultCurrencyCode}`
  const priceEnabledField = `${priceField}Enabled`

  for (const [index, item] of doc.items.entries()) {
    const lineNumber = index + 1
    const gcodeID = resolveRelationID(item.gcode)
    const quoteItemID = typeof item.id === 'string' && item.id.length > 0 ? item.id : null

    if (typeof gcodeID !== 'number' || !quoteItemID) {
      continue
    }

    const existingForQuoteLine = await req.payload.find({
      collection: 'products',
      depth: 0,
      limit: 1,
      pagination: false,
      req,
      overrideAccess: true,
      where: {
        and: [
          {
            quote: {
              equals: doc.id,
            },
          },
          {
            quoteItemID: {
              equals: quoteItemID,
            },
          },
        ],
      },
    })

    if (existingForQuoteLine.docs.length > 0) {
      continue
    }

    const gcode = await req.payload.findByID({
      collection: 'gcodes',
      id: gcodeID,
      depth: 0,
      req,
      overrideAccess: true,
      select: {
        model: true,
        filament: true,
        process: true,
        estimatedPrice: true,
        priceOverride: true,
        estimatedDuration: true,
        durationOverride: true,
        estimatedWeight: true,
        weightOverride: true,
      },
    })

    const modelID = resolveRelationID(gcode.model)
    const filamentID = resolveRelationID(gcode.filament)
    const processID = resolveRelationID(gcode.process)
    const colourID = resolveRelationID(item.colour)

    const [model, filament, process, colour] = await Promise.all([
      modelID
        ? req.payload.findByID({
            collection: 'models',
            id: modelID,
            depth: 0,
            req,
            overrideAccess: true,
            select: {
              originalFilename: true,
            },
          })
        : null,
      filamentID
        ? req.payload.findByID({
            collection: 'filaments',
            id: filamentID,
            depth: 0,
            req,
            overrideAccess: true,
            select: {
              name: true,
            },
          })
        : null,
      processID
        ? req.payload.findByID({
            collection: 'processes',
            id: processID,
            depth: 0,
            req,
            overrideAccess: true,
            select: {
              name: true,
            },
          })
        : null,
      colourID
        ? req.payload.findByID({
            collection: 'colours',
            id: colourID,
            depth: 0,
            req,
            overrideAccess: true,
            select: {
              name: true,
              finish: true,
              type: true,
            },
          })
        : null,
    ])

    const approvedPrice =
      typeof gcode.priceOverride === 'number'
        ? gcode.priceOverride
        : typeof gcode.estimatedPrice === 'number'
          ? gcode.estimatedPrice
          : undefined
    const effectiveDuration =
      typeof gcode.durationOverride === 'number'
        ? gcode.durationOverride
        : typeof gcode.estimatedDuration === 'number'
          ? gcode.estimatedDuration
          : undefined
    const effectiveWeight =
      typeof gcode.weightOverride === 'number'
        ? gcode.weightOverride
        : typeof gcode.estimatedWeight === 'number'
          ? gcode.estimatedWeight
          : undefined

    const modelOriginalFilename = toOptionalString(model?.originalFilename)
    const derivedTitle = modelOriginalFilename
      ? stripExtension(modelOriginalFilename)
      : `Quote ${doc.id} item ${lineNumber}`

    const processName = toOptionalString(process?.name)
    const filamentName = toOptionalString(filament?.name)
    const colourName = toOptionalString(colour?.name)
    const colourFinish = toOptionalString(colourFinishLabel[colour?.finish ?? ''])
    const colourType = toOptionalString(colourTypeLabel[colour?.type ?? ''])
    const colourDetails = [colourName, colourFinish, colourType].filter((value): value is string =>
      Boolean(value),
    )
    const colourDisplay = colourDetails.length > 0 ? colourDetails.join(' - ') : undefined
    const quantity = toOptionalNumber(item.quantity)

    const modelSlugPart = kebabCase(derivedTitle) || `quote-${doc.id}-item-${lineNumber}`
    const quoteItemSlugPart = kebabCase(quoteItemID) || `item-${lineNumber}`
    const slugBase = `${modelSlugPart}-q${doc.id}-qi${quoteItemSlugPart}`
    const slug = await getUniqueSlug({ req, slugBase })

    const productData: RequiredDataFromCollectionSlug<'products'> = {
      title: derivedTitle,
      slug,
      quote: doc.id,
      quoteItemID,
      gcode: gcodeID,
      _status: 'published',
      enableVariants: false,
      inventory: 100,
      description: buildDescription({
        quoteID: doc.id,
        modelName: derivedTitle,
        processName,
        filamentName,
        colourName: colourDisplay,
        quantity,
        durationSeconds: effectiveDuration,
        weightGrams: effectiveWeight,
      }),
    }

    if (typeof approvedPrice === 'number') {
      const mutableProductData = productData as Record<string, unknown>
      mutableProductData[priceField] = approvedPrice
      mutableProductData[priceEnabledField] = true
    }

    await req.payload.create({
      collection: 'products',
      req,
      overrideAccess: true,
      data: productData,
    })
  }

  return doc
}
