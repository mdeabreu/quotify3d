'use server'

import { redirect } from 'next/navigation'

import type { SaveQuoteItemResult } from '@/components/QuoteDetailsWorkspace/types'
import {
  cleanupUploadedModels,
  deleteModelIfUnreferenced,
  uploadQuoteModels,
} from '@/lib/quotes/modelUploads'
import {
  analyzeQuoteItemConfiguration,
  getSlicingSelectionKey,
  type QuoteItem,
} from '@/lib/quotes/quoteItemConfiguration'
import { getQuotePath, serializeQuoteItem } from '@/lib/quotes/workspaceData'
import { getQuoteActionContext, updateQuoteFromAction } from '@/lib/quotes/workspaceActionContext'
import type { Quote } from '@/payload-types'
import { resolveRelationID } from '@/utilities/resolveRelationID'

const parseSlots = (formData: FormData) => {
  const parsed = JSON.parse(String(formData.get('filamentSlots') ?? '[]'))
  if (!Array.isArray(parsed)) return []
  return parsed.map((slot) => {
    const colour = Number.parseInt(String(slot?.colour ?? ''), 10)
    const description = typeof slot?.description === 'string' ? slot.description.trim() : ''
    return {
      ...(Number.isInteger(colour) ? { colour } : {}),
      ...(description ? { description } : {}),
    }
  })
}

export const saveQuoteItemAction = async (formData: FormData): Promise<SaveQuoteItemResult> => {
  const context = await getQuoteActionContext(formData)
  const itemID = String(formData.get('itemID') ?? '')
  if (!context || !itemID) {
    return { error: 'This quote can no longer be edited.', success: false }
  }

  const selectedItem = context.quote.items.find((item) => item.id === itemID)
  const model = typeof selectedItem?.model === 'object' ? selectedItem.model : null
  if (!selectedItem || !model) {
    return { error: 'The selected model could not be found.', success: false }
  }

  const filamentValue = String(formData.get('filament') ?? '')
  const processValue = String(formData.get('process') ?? '')
  const filament = filamentValue ? Number.parseInt(filamentValue, 10) : null
  const process = processValue ? Number.parseInt(processValue, 10) : null
  const quantity = Number.parseInt(String(formData.get('quantity') ?? ''), 10)
  const notes = String(formData.get('notes') ?? '').trim()
  if (
    (filament !== null && !Number.isInteger(filament)) ||
    (process !== null && !Number.isInteger(process)) ||
    !Number.isInteger(quantity) ||
    quantity < 1
  ) {
    return { error: 'One or more model selections are invalid.', success: false }
  }

  let slots: ReturnType<typeof parseSlots>
  try {
    slots = parseSlots(formData)
  } catch {
    return { error: 'The colour assignments could not be read.', success: false }
  }

  const slotCount = Math.max(1, Math.floor(model.filamentSlotCount || 1))
  if (slots.length !== slotCount) {
    return { error: 'The colour assignments do not match this model.', success: false }
  }
  const colours = slots.flatMap((slot) => (slot.colour ? [slot.colour] : []))
  if (colours.length === slotCount && colours.every((colour) => colour === colours[0])) {
    slots = slots.map((slot) => ({ colour: slot.colour }))
  }

  let updatedItem: QuoteItem | null = null
  const nextItems = context.quote.items
    .map((item) => {
      const serialized = serializeQuoteItem(item)
      if (!serialized) return null
      if (item.id !== itemID) return serialized

      updatedItem = {
        ...serialized,
        filament: filament ?? undefined,
        filamentSlots: slots,
        notes: notes || undefined,
        process: process ?? undefined,
        quantity,
      } as QuoteItem
      return updatedItem
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))

  if (!updatedItem || nextItems.length !== context.quote.items.length) {
    return { error: 'The model could not be updated.', success: false }
  }

  const analysis = await analyzeQuoteItemConfiguration({
    item: updatedItem,
    payload: context.payload,
  })
  const changed = getSlicingSelectionKey(selectedItem) !== getSlicingSelectionKey(updatedItem)
  await updateQuoteFromAction({
    ...context,
    data: {
      items: nextItems,
      ...(!analysis.complete
        ? { status: 'new' }
        : changed || context.quote.status === 'new'
          ? { status: 'queued' }
          : {}),
    },
  })

  return { success: true }
}

export const removeQuoteItemAction = async (formData: FormData) => {
  const context = await getQuoteActionContext(formData)
  const itemID = String(formData.get('itemID') ?? '')
  if (!context || !itemID || context.quote.items.length <= 1) return

  const removedIndex = context.quote.items.findIndex((item) => item.id === itemID)
  if (removedIndex < 0) return
  const removedModelID = resolveRelationID(context.quote.items[removedIndex]?.model)
  const nextItems = context.quote.items
    .filter((item) => item.id !== itemID)
    .map(serializeQuoteItem)
    .filter((item): item is NonNullable<typeof item> => Boolean(item))

  await updateQuoteFromAction({ ...context, data: { items: nextItems } })
  if (typeof removedModelID === 'number') {
    await deleteModelIfUnreferenced({ modelID: removedModelID, payload: context.payload })
  }

  const fallbackIndex = Math.min(Math.max(removedIndex, 0), nextItems.length - 1)
  redirect(
    getQuotePath(
      context.quoteID,
      context.customerEmail,
      context.accessToken,
      nextItems[fallbackIndex]?.id,
    ),
  )
}

export const addQuoteModelsAction = async (formData: FormData) => {
  const context = await getQuoteActionContext(formData)
  if (!context) return
  const files = formData
    .getAll('files')
    .filter((value): value is File => value instanceof File && value.size > 0)
  if (!files.length) return

  const models = await uploadQuoteModels({
    customerEmail: context.customerEmail,
    files,
    payload: context.payload,
    user: context.user,
  })
  const existingItems = context.quote.items
    .map(serializeQuoteItem)
    .filter((item): item is NonNullable<typeof item> => Boolean(item))

  let updatedQuote: Quote
  try {
    updatedQuote = await updateQuoteFromAction({
      ...context,
      data: {
        items: [...existingItems, ...models.map((model) => ({ model: model.id, quantity: 1 }))],
        status: 'new',
      },
    })
  } catch (error) {
    await cleanupUploadedModels(context.payload, models)
    throw error
  }

  redirect(
    getQuotePath(
      context.quoteID,
      context.customerEmail,
      context.accessToken,
      updatedQuote.items.at(-1)?.id ?? undefined,
    ),
  )
}

export const submitQuoteForReviewAction = async (formData: FormData) => {
  const context = await getQuoteActionContext(formData)
  if (!context) return
  const notes = String(formData.get('notes') ?? '').trim()
  await updateQuoteFromAction({
    ...context,
    data: { notes: notes || null, status: 'ready-for-review' },
  })
  redirect(getQuotePath(context.quoteID, context.customerEmail, context.accessToken))
}
