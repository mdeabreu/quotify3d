import type { CollectionAfterChangeHook, RequiredDataFromCollectionSlug } from 'payload'

import { currenciesConfig } from '@/config/currencies'

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

const buildDescription = ({
  gcodeID,
  durationSeconds,
  weightGrams,
}: {
  gcodeID: number
  durationSeconds?: number
  weightGrams?: number
}) => {
  const durationText =
    typeof durationSeconds === 'number' ? formatDuration(durationSeconds) : 'Not available'
  const weightText = typeof weightGrams === 'number' ? formatWeight(weightGrams) : 'Not available'

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
          version: 1,
          direction: 'ltr' as const,
          format: '' as const,
          indent: 0,
          children: [
            {
              type: 'text',
              version: 1,
              detail: 0,
              format: 0,
              mode: 'normal' as const,
              style: '',
              text: 'Production Summary',
            },
          ],
        },
        {
          type: 'paragraph',
          version: 1,
          direction: 'ltr' as const,
          format: '' as const,
          indent: 0,
          textFormat: 0,
          textStyle: '',
          children: [
            {
              type: 'text',
              version: 1,
              detail: 0,
              format: 0,
              mode: 'normal' as const,
              style: '',
              text: `Generated from approved G-code #${gcodeID}.`,
            },
          ],
        },
        {
          type: 'paragraph',
          version: 1,
          direction: 'ltr' as const,
          format: '' as const,
          indent: 0,
          textFormat: 0,
          textStyle: '',
          children: [
            {
              type: 'text',
              version: 1,
              detail: 0,
              format: 0,
              mode: 'normal' as const,
              style: '',
              text: `Estimated print time: ${durationText}.`,
            },
          ],
        },
        {
          type: 'paragraph',
          version: 1,
          direction: 'ltr' as const,
          format: '' as const,
          indent: 0,
          textFormat: 0,
          textStyle: '',
          children: [
            {
              type: 'text',
              version: 1,
              detail: 0,
              format: 0,
              mode: 'normal' as const,
              style: '',
              text: `Estimated filament weight: ${weightText}.`,
            },
          ],
        },
      ],
    },
  }
}

export const createProductOnApproval: CollectionAfterChangeHook = async ({
  doc,
  operation,
  previousDoc,
  req,
}) => {
  if (!doc) return doc

  const movedToApproved =
    doc.status === 'approved' && (operation === 'create' || previousDoc?.status !== 'approved')

  if (!movedToApproved) {
    return doc
  }

  const existingProduct = await req.payload.find({
    collection: 'products',
    depth: 0,
    limit: 1,
    req,
    overrideAccess: true,
    where: {
      gcode: {
        equals: doc.id,
      },
    },
  })

  if (existingProduct.docs.length > 0) {
    return doc
  }

  const approvedPrice =
    typeof doc.priceOverride === 'number'
      ? doc.priceOverride
      : typeof doc.estimatedPrice === 'number'
        ? doc.estimatedPrice
        : undefined
  const effectiveDuration =
    typeof doc.durationOverride === 'number'
      ? doc.durationOverride
      : typeof doc.estimatedDuration === 'number'
        ? doc.estimatedDuration
        : undefined
  const effectiveWeight =
    typeof doc.weightOverride === 'number'
      ? doc.weightOverride
      : typeof doc.estimatedWeight === 'number'
        ? doc.estimatedWeight
        : undefined
  const defaultCurrencyCode = currenciesConfig.defaultCurrency.toUpperCase()
  const priceField = `priceIn${defaultCurrencyCode}`
  const priceEnabledField = `${priceField}Enabled`

  const productData: RequiredDataFromCollectionSlug<'products'> = {
    title: `Gcode ${doc.id}`,
    slug: `gcode-${doc.id}`,
    gcode: doc.id,
    _status: 'published',
    inventory: 100,
    description: buildDescription({
      gcodeID: doc.id,
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

  return doc
}
