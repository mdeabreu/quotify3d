import type { CollectionAfterChangeHook, RequiredDataFromCollectionSlug } from 'payload'

import { currenciesConfig } from '@/config/currencies'

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
  const defaultCurrencyCode = currenciesConfig.defaultCurrency.toUpperCase()
  const priceField = `priceIn${defaultCurrencyCode}`
  const priceEnabledField = `${priceField}Enabled`

  const productData: RequiredDataFromCollectionSlug<'products'> = {
    title: `Gcode ${doc.id}`,
    slug: `gcode-${doc.id}`,
    gcode: doc.id,
    _status: 'published',
    inventory: 100,
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
