import type { CollectionBeforeChangeHook } from 'payload'

import { ecommerceCurrenciesConfig } from '@/config/currencies'
import { resolveRelationID } from '@/collections/Quotes/relations'

export const resolveQuoteItemsAndAmount: CollectionBeforeChangeHook = async ({ data, req }) => {
  if (!data) return data

  let totalAmount = 0

  if (Array.isArray(data.items) && data.items.length > 0) {
    const filamentCache = new Map<string, number | string | null>()
    const materialPriceCache = new Map<string, number | null>()

    const normalizedItems: typeof data.items = []

    for (const item of data.items) {
      if (!item) {
        normalizedItems.push(item)
        continue
      }

      const material = resolveRelationID(item.material)
      const colour = resolveRelationID(item.colour)

      let filamentID: number | string | null = null

      if (material && colour) {
        const cacheKey = `${material}:${colour}`
        if (filamentCache.has(cacheKey)) {
          filamentID = filamentCache.get(cacheKey) ?? null
        } else {
          const { docs } = await req.payload.find({
            collection: 'filaments',
            limit: 1,
            req,
            where: {
              and: [
                {
                  material: {
                    equals: material,
                  },
                },
                {
                  colour: {
                    equals: colour,
                  },
                },
                {
                  active: {
                    equals: true,
                  },
                },
              ],
            },
          })

          filamentID = docs?.[0]?.id ?? null
          filamentCache.set(cacheKey, filamentID)
        }
      }

      const grams = typeof item.grams === 'number' && item.grams > 0 ? item.grams : 0
      const rawQuantity =
        typeof item.quantity === 'number' && Number.isFinite(item.quantity) ? item.quantity : 1
      const quantity = Math.max(1, Math.floor(rawQuantity))
      const hasOverride = typeof item.priceOverride === 'number'
      let lineAmount = 0

      if (hasOverride) {
        const overrideValue = Math.max(0, item.priceOverride as number)
        lineAmount = overrideValue * quantity
      } else if (grams > 0) {
        let pricePerGram = 0
        if (material) {
          const materialKey = String(material)

          if (!materialPriceCache.has(materialKey)) {
            let cachedPrice: number | null = null

            if (item.material && typeof item.material === 'object') {
              const maybePrice = (item.material as Record<string, unknown>).pricePerGram
              if (typeof maybePrice === 'number') {
                cachedPrice = maybePrice
              }
            }

            if (cachedPrice === null) {
              try {
                const materialDoc = await req.payload.findByID({
                  collection: 'materials',
                  depth: 0,
                  id: material,
                  req,
                })
                cachedPrice =
                  typeof materialDoc?.pricePerGram === 'number' ? materialDoc.pricePerGram : null
              } catch {
                cachedPrice = null
              }
            }

            materialPriceCache.set(materialKey, cachedPrice)
          }

          const materialSpecificPrice = materialPriceCache.get(materialKey)
          if (typeof materialSpecificPrice === 'number') {
            pricePerGram = materialSpecificPrice
          }
        }

        if (pricePerGram > 0) {
          lineAmount = Math.round(pricePerGram * grams * quantity * 100)
        }
      }

      totalAmount += lineAmount

      normalizedItems.push({
        ...item,
        filament: filamentID,
        quantity,
        lineAmount,
      })
    }

    data.items = normalizedItems
  }

  data.amount = totalAmount
  if (!data.currency) {
    data.currency = ecommerceCurrenciesConfig.defaultCurrency
  }

  return data
}
