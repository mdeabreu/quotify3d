import type { QuoteItemConfigurationIssue } from '@/lib/quotes/quoteItemConfiguration'
import type {
  AvailableFilamentOption,
  AvailableProcessOption,
  AvailableSpoolOption,
} from '@/lib/spoolAvailability'
import type { QuoteStatus } from '@/payload-types'

export type QuoteWorkspaceSlot = {
  colourId: string
  colourLabel: string
  description: string
  hex: string
}

export type QuoteWorkspaceItem = {
  configurationIssues: QuoteItemConfigurationIssue[]
  configured: boolean
  filamentId: string
  filamentLabel: string
  filamentSlots: QuoteWorkspaceSlot[]
  gcodeDuration: number | null
  gcodePrice: number | null
  gcodeStatus: string | null
  gcodeWeight: number | null
  id: string
  modelLabel: string
  modelNote: string
  modelSize?: number
  modelSlotCount: number
  modelURL: string
  processId: string
  processLabel: string
  productID?: number
  productSlug?: string
  quantity: number
}

export type SaveQuoteItemResult =
  | { error: string; success: false }
  | { error?: never; success: true }

export type QuoteDetailsWorkspaceProps = {
  accessToken?: string
  addModelsAction: (formData: FormData) => void | Promise<void>
  currencyCode?: string
  editable: boolean
  email?: string
  initialItemID?: string
  items: QuoteWorkspaceItem[]
  materialOptions: AvailableFilamentOption[]
  qualityOptions: AvailableProcessOption[]
  quoteID: number
  quoteNotes?: string | null
  quoteStatus: QuoteStatus
  removeItemAction: (formData: FormData) => void | Promise<void>
  saveItemAction: (formData: FormData) => Promise<SaveQuoteItemResult>
  spoolOptions: AvailableSpoolOption[]
  submitForReviewAction: (formData: FormData) => void | Promise<void>
}
