'use client'

import { ColourOptionPreview } from '@/components/ColourPreview'
import { ModelPreviewer } from '@/components/ModelPreviewer'
import { Price } from '@/components/Price'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  getUnsupportedModelFilesMessage,
  getUnsupportedModelFilenames,
  MODEL_UPLOAD_ACCEPT,
  MODEL_UPLOAD_FORMAT_LABEL,
} from '@/lib/modelUploadFormats'
import {
  uniqueOptions,
  type AvailableFilamentOption,
  type AvailableOption,
  type AvailableProcessOption,
  type AvailableSpoolOption,
} from '@/lib/spoolAvailability'
import type { QuoteStatus } from '@/payload-types'
import { useBranding } from '@/providers/Branding'
import { cn } from '@/utilities/cn'
import { formatDuration, formatWeight } from '@/utilities/formatPrintMetrics'
import {
  AlertTriangleIcon,
  CheckIcon,
  ClockIcon,
  FilePlus2Icon,
  Layers3Icon,
  PaletteIcon,
  PrinterIcon,
  Trash2Icon,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
} from 'react'

export type QuoteWorkspaceSlot = {
  colourId: string
  colourLabel: string
  description: string
  hex: string
}

export type QuoteWorkspaceItem = {
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
  quantity: number
}

export type SaveQuoteItemResult =
  | { error: string; success: false }
  | { error?: never; success: true }

type Props = {
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

type ItemDraft = {
  filamentId: string
  filamentLabel: string
  modelNote: string
  processId: string
  processLabel: string
  quantity: number
  sameColour: boolean
  slots: QuoteWorkspaceSlot[]
}

const AUTO_REFRESH_INTERVAL_MS = 3000
const IN_PROGRESS = new Set(['queued', 'collecting-context', 'slicing', 'parsing'])
const TERMINAL = new Set(['sliced', 'failed'])
const EMPTY_SLOT: QuoteWorkspaceSlot = {
  colourId: '',
  colourLabel: '',
  description: '',
  hex: '#808080',
}

const normalizeSlots = (item: QuoteWorkspaceItem) =>
  Array.from({ length: item.modelSlotCount }, (_, index) => ({
    ...EMPTY_SLOT,
    ...item.filamentSlots[index],
  }))

const usesSameColour = (item: Pick<QuoteWorkspaceItem, 'filamentSlots' | 'modelSlotCount'>) =>
  item.filamentSlots.length === item.modelSlotCount &&
  Boolean(item.filamentSlots[0]?.colourId) &&
  item.filamentSlots.every((slot) => slot.colourId === item.filamentSlots[0]?.colourId)

const createDraft = (item: QuoteWorkspaceItem): ItemDraft => ({
  filamentId: item.filamentId,
  filamentLabel: item.filamentLabel,
  modelNote: item.modelNote,
  processId: item.processId,
  processLabel: item.processLabel,
  quantity: item.quantity,
  sameColour: item.modelSlotCount === 1 || usesSameColour(item),
  slots: normalizeSlots(item),
})

const serializeDraft = (draft: ItemDraft) =>
  JSON.stringify({
    filamentId: draft.filamentId,
    modelNote: draft.modelNote,
    processId: draft.processId,
    quantity: draft.quantity,
    sameColour: draft.sameColour,
    slots: draft.slots.map((slot) => ({
      colourId: slot.colourId,
      description: draft.sameColour ? '' : slot.description,
    })),
  })

const serializeSlicingDraft = (draft: ItemDraft) =>
  JSON.stringify({
    filamentId: draft.filamentId,
    processId: draft.processId,
    slots: draft.slots.map((slot) => slot.colourId),
  })

const selectedColourCount = (item: QuoteWorkspaceItem) =>
  usesSameColour(item) ? 1 : item.filamentSlots.filter((slot) => slot.colourId).length

export const shouldAutoRefreshQuote = ({
  editable,
  hasFailedItems,
  hasInProgressItems,
  hasPendingPrices,
  quoteStatus,
}: {
  editable: boolean
  hasFailedItems: boolean
  hasInProgressItems: boolean
  hasPendingPrices: boolean
  quoteStatus: QuoteStatus
}) =>
  editable &&
  (hasInProgressItems || (!hasFailedItems && quoteStatus === 'queued' && hasPendingPrices))

const AccessFields = ({
  accessToken,
  email,
  itemID,
  quoteID,
}: {
  accessToken?: string
  email?: string
  itemID?: string
  quoteID: number
}) => (
  <>
    <input name="quoteID" type="hidden" value={quoteID} />
    {itemID ? <input name="itemID" type="hidden" value={itemID} /> : null}
    {email ? <input name="email" type="hidden" value={email} /> : null}
    {accessToken ? <input name="accessToken" type="hidden" value={accessToken} /> : null}
  </>
)

const OptionCard = ({
  fallback,
  onSelect,
  option,
  selected,
}: {
  fallback?: ReactNode
  onSelect: (option: AvailableOption) => void
  option: AvailableOption
  selected: boolean
}) => (
  <button
    className={cn(
      'min-w-0 rounded-md border bg-background p-3 text-left transition hover:border-primary/60',
      selected && 'border-primary bg-primary/5',
    )}
    onClick={() => onSelect(option)}
    type="button"
  >
    {option.imageUrl ? (
      <img alt="" className="h-24 w-full rounded-sm border object-cover" src={option.imageUrl} />
    ) : fallback ? (
      fallback
    ) : null}
    <div className="mt-2 flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="font-medium">{option.name}</p>
        {option.description ? (
          <p className="mt-1 line-clamp-2 text-sm text-primary/60">{option.description}</p>
        ) : null}
      </div>
      {selected ? <CheckIcon className="mt-0.5 size-4 shrink-0" /> : null}
    </div>
  </button>
)

const OptionDialog = ({
  description,
  fallback,
  onSelect,
  open,
  options,
  selectedID,
  setOpen,
  title,
}: {
  description: string
  fallback?: (option: AvailableOption) => ReactNode
  onSelect: (option: AvailableOption) => void
  open: boolean
  options: AvailableOption[]
  selectedID: string
  setOpen: (open: boolean) => void
  title: string
}) => (
  <Dialog onOpenChange={setOpen} open={open}>
    <DialogContent className="sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <div className="grid max-h-[65vh] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3">
        {options.map((option) => (
          <OptionCard
            fallback={fallback?.(option)}
            key={option.id}
            onSelect={(selected) => {
              onSelect(selected)
              setOpen(false)
            }}
            option={option}
            selected={selectedID === String(option.id)}
          />
        ))}
      </div>
    </DialogContent>
  </Dialog>
)

const itemState = (item: QuoteWorkspaceItem) => {
  if (!item.configured) return { label: 'Needs setup', tone: 'text-amber-700' }
  if (item.gcodeStatus === 'failed') return { label: 'Needs review', tone: 'text-red-600' }
  if (item.gcodeStatus === 'sliced') return { label: 'Estimated', tone: 'text-green-700' }
  return { label: 'Estimating', tone: 'text-primary/60' }
}

export const QuoteDetailsWorkspace = ({
  accessToken = '',
  addModelsAction,
  currencyCode,
  editable,
  email = '',
  initialItemID = '',
  items,
  materialOptions,
  qualityOptions,
  quoteID,
  quoteNotes,
  quoteStatus,
  removeItemAction,
  saveItemAction,
  spoolOptions,
  submitForReviewAction,
}: Props) => {
  const router = useRouter()
  const { quoteProductPlaceholder } = useBranding()
  const initialActiveID = items.some((item) => item.id === initialItemID)
    ? initialItemID
    : (items[0]?.id ?? '')
  const initialItem = items.find((item) => item.id === initialActiveID) ?? items[0]
  const [activeID, setActiveID] = useState(initialActiveID)
  const [draft, setDraft] = useState<ItemDraft>(() => createDraft(initialItem))
  const [savedDraft, setSavedDraft] = useState(() => serializeDraft(createDraft(initialItem)))
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [materialOpen, setMaterialOpen] = useState(false)
  const [processOpen, setProcessOpen] = useState(false)
  const [colourSlot, setColourSlot] = useState<number | null>(null)
  const [pending, startTransition] = useTransition()
  const activeItem = items.find((item) => item.id === activeID) ?? items[0]
  const currentDraft = serializeDraft(draft)
  const dirty = currentDraft !== savedDraft
  const slicingDirty =
    serializeSlicingDraft(draft) !== serializeSlicingDraft(createDraft(activeItem))
  const availableColours = useMemo(
    () =>
      uniqueOptions(
        spoolOptions.filter((option) => String(option.filament.id) === draft.filamentId),
        'colour',
      ),
    [draft.filamentId, spoolOptions],
  )
  const hasInProgress = items.some(
    (item) => item.configured && IN_PROGRESS.has(item.gcodeStatus ?? ''),
  )
  const hasFailed = items.some((item) => item.gcodeStatus === 'failed')
  const hasPendingPrices = items.some((item) => item.configured && item.gcodePrice === null)
  const shouldRefresh = shouldAutoRefreshQuote({
    editable,
    hasFailedItems: hasFailed,
    hasInProgressItems: hasInProgress,
    hasPendingPrices,
    quoteStatus,
  })
  const canSubmit =
    editable &&
    items.length > 0 &&
    items.every((item) => item.configured && TERMINAL.has(item.gcodeStatus ?? ''))
  const subtotal = items.reduce(
    (total, item) =>
      total + (item.configured && item.gcodePrice !== null ? item.gcodePrice * item.quantity : 0),
    0,
  )
  const refresh = useEffectEvent(() => router.refresh())

  useEffect(() => {
    if (!shouldRefresh) return
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh()
    }, AUTO_REFRESH_INTERVAL_MS)
    return () => window.clearInterval(interval)
  }, [shouldRefresh])

  if (!activeItem) return null

  const selectItem = (itemID: string) => {
    if (itemID === activeItem.id) return
    if (dirty && !window.confirm('Discard your unapplied changes and switch models?')) return
    const nextItem = items.find((item) => item.id === itemID)
    if (!nextItem) return
    const nextDraft = createDraft(nextItem)
    setActiveID(itemID)
    setDraft(nextDraft)
    setSavedDraft(serializeDraft(nextDraft))
    setSaveError(null)
    const url = new URL(window.location.href)
    url.searchParams.set('item', itemID)
    window.history.replaceState(null, '', url)
  }

  const validateUpload = (event: FormEvent<HTMLFormElement>) => {
    const files = new FormData(event.currentTarget)
      .getAll('files')
      .filter((value): value is File => value instanceof File)
    const unsupported = getUnsupportedModelFilenames(files)
    if (unsupported.length === 0) return
    event.preventDefault()
    setUploadError(getUnsupportedModelFilesMessage(unsupported))
  }

  const setSameColour = (sameColour: boolean) => {
    setDraft((current) => {
      if (!sameColour) return { ...current, sameColour: false }
      const selected = current.slots.find((slot) => slot.colourId) ?? EMPTY_SLOT
      return {
        ...current,
        sameColour: true,
        slots: current.slots.map(() => ({ ...selected, description: '' })),
      }
    })
  }

  const applyDraft = () => {
    const assignedColours = draft.slots.map((slot) => slot.colourId).filter(Boolean)
    const sameColour =
      draft.sameColour ||
      (assignedColours.length === activeItem.modelSlotCount &&
        assignedColours.every((colour) => colour === assignedColours[0]))
    const submittedDraft = {
      ...draft,
      sameColour,
      slots: sameColour ? draft.slots.map((slot) => ({ ...slot, description: '' })) : draft.slots,
    }
    const formData = new FormData()
    formData.set('quoteID', String(quoteID))
    formData.set('itemID', activeItem.id)
    formData.set('email', email)
    formData.set('accessToken', accessToken)
    formData.set('filament', submittedDraft.filamentId)
    formData.set('process', submittedDraft.processId)
    formData.set('quantity', String(submittedDraft.quantity))
    formData.set('notes', submittedDraft.modelNote)
    formData.set(
      'filamentSlots',
      JSON.stringify(
        submittedDraft.slots.map((slot) => ({
          colour: slot.colourId,
          description: submittedDraft.sameColour ? '' : slot.description,
        })),
      ),
    )
    setSaveError(null)
    startTransition(async () => {
      const result = await saveItemAction(formData)
      if (!result.success) {
        setSaveError(result.error)
        return
      }
      setDraft(submittedDraft)
      setSavedDraft(serializeDraft(submittedDraft))
      router.refresh()
    })
  }

  const discardDraft = () => {
    const persisted = createDraft(activeItem)
    setDraft(persisted)
    setSavedDraft(serializeDraft(persisted))
    setSaveError(null)
  }

  const chooseColour = (option: AvailableOption) => {
    const selectedIndex = draft.sameColour ? 0 : (colourSlot ?? 0)
    const apply = (slot: QuoteWorkspaceSlot): QuoteWorkspaceSlot => ({
      ...slot,
      colourId: String(option.id),
      colourLabel: option.name,
      hex: 'swatches' in option ? option.swatches[0] || '#808080' : '#808080',
    })
    setDraft((current) => ({
      ...current,
      slots: current.sameColour
        ? current.slots.map((slot) => ({ ...apply(slot), description: '' }))
        : current.slots.map((slot, index) => (index === selectedIndex ? apply(slot) : slot)),
    }))
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="grid min-h-[44rem] lg:grid-cols-[23rem_minmax(0,1fr)]">
        <aside className="border-b bg-background lg:border-r lg:border-b-0">
          <div className="flex items-center justify-between border-b px-4 py-4">
            <div>
              <h2 className="font-medium">Your quote</h2>
              <p className="text-sm text-primary/55">
                {items.length} model{items.length === 1 ? '' : 's'}
              </p>
            </div>
            {editable ? (
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="icon" title="Add model" variant="outline">
                    <FilePlus2Icon className="size-4" />
                    <span className="sr-only">Add model</span>
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add another model</DialogTitle>
                    <DialogDescription>
                      The new item starts without material, colour, or process selections.
                    </DialogDescription>
                  </DialogHeader>
                  <form action={addModelsAction} onSubmit={validateUpload}>
                    <AccessFields accessToken={accessToken} email={email} quoteID={quoteID} />
                    <Input
                      accept={MODEL_UPLOAD_ACCEPT}
                      multiple
                      name="files"
                      required
                      type="file"
                    />
                    <p className="mt-2 text-xs text-primary/55">{MODEL_UPLOAD_FORMAT_LABEL}</p>
                    {uploadError ? (
                      <p className="mt-2 text-sm text-red-500">{uploadError}</p>
                    ) : null}
                    <DialogFooter className="mt-5">
                      <Button type="submit">Upload</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            ) : null}
          </div>

          <div className="divide-y">
            {items.map((item) => {
              const state = itemState(item)
              return (
                <button
                  className={cn(
                    'w-full px-4 py-4 text-left transition hover:bg-primary/5',
                    activeItem.id === item.id && 'bg-primary/5',
                  )}
                  key={item.id}
                  onClick={() => selectItem(item.id)}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 truncate font-medium">{item.modelLabel}</p>
                    <span className={cn('shrink-0 text-xs', state.tone)}>{state.label}</span>
                  </div>
                  <p className="mt-2 truncate text-sm text-primary/55">
                    {item.filamentLabel || 'Material'} ·{' '}
                    {item.filamentSlots.some((slot) => slot.colourId)
                      ? `${selectedColourCount(item)} colour${selectedColourCount(item) === 1 ? '' : 's'}`
                      : `${item.modelSlotCount} colour slot${item.modelSlotCount === 1 ? '' : 's'}`}{' '}
                    · {item.processLabel || 'Process'}
                  </p>
                  <div className="mt-3 flex items-end justify-between gap-3 text-sm">
                    <span>Qty {item.quantity}</span>
                    {item.configured && item.gcodePrice !== null ? (
                      <Price amount={item.gcodePrice * item.quantity} currencyCode={currencyCode} />
                    ) : (
                      <span className="text-primary/45">Pending</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          <div className="border-t p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-primary/60">
                {items.some((item) => item.gcodePrice === null)
                  ? 'Partial estimate'
                  : 'Estimated total'}
              </span>
              <Price
                amount={subtotal}
                className="text-xl font-medium"
                currencyCode={currencyCode}
              />
            </div>
            {editable ? (
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="mt-4 w-full" disabled={!canSubmit}>
                    Submit for review
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Submit this quote?</DialogTitle>
                    <DialogDescription>
                      Your selections will be locked while our team reviews them.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="max-h-[45vh] divide-y overflow-y-auto rounded-md border">
                    {items.map((item) => (
                      <div
                        className="flex items-center justify-between gap-4 px-4 py-3"
                        key={item.id}
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">{item.modelLabel}</p>
                          <p className="text-sm text-primary/55">
                            {item.filamentLabel} · {item.processLabel} · Qty {item.quantity}
                          </p>
                        </div>
                        {item.gcodeStatus === 'failed' ? (
                          <span className="text-sm text-red-600">Manual review</span>
                        ) : (
                          <Price
                            amount={(item.gcodePrice ?? 0) * item.quantity}
                            currencyCode={currencyCode}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                  <form action={submitForReviewAction}>
                    <AccessFields accessToken={accessToken} email={email} quoteID={quoteID} />
                    <div className="mt-4 space-y-2">
                      <Label htmlFor="quote-notes">Note for the whole quote</Label>
                      <Textarea
                        defaultValue={quoteNotes ?? ''}
                        id="quote-notes"
                        name="notes"
                        placeholder="Anything else our team should know"
                        rows={3}
                      />
                    </div>
                    <DialogFooter className="mt-5">
                      <Button type="submit">Confirm submission</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            ) : null}
            {!canSubmit && editable ? (
              <p className="mt-2 text-xs text-primary/50">
                Complete every item and wait for each estimate to finish.
              </p>
            ) : null}
          </div>
        </aside>

        <main className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
            <div>
              <h2 className="text-xl font-medium break-all">{activeItem.modelLabel}</h2>
              <p className={cn('mt-1 text-sm', itemState(activeItem).tone)}>
                {itemState(activeItem).label}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-sm border px-2 py-1 text-xs text-primary/60">
                {activeItem.modelSlotCount} colour slot{activeItem.modelSlotCount === 1 ? '' : 's'}
              </span>
              {editable && items.length > 1 ? (
                <form action={removeItemAction}>
                  <AccessFields
                    accessToken={accessToken}
                    email={email}
                    itemID={activeItem.id}
                    quoteID={quoteID}
                  />
                  <Button size="icon" title="Remove model" type="submit" variant="outline">
                    <Trash2Icon className="size-4" />
                    <span className="sr-only">Remove model</span>
                  </Button>
                </form>
              ) : null}
            </div>
          </div>

          <div className="aspect-[16/9] min-h-72 overflow-hidden border-b">
            <ModelPreviewer
              colors={draft.slots.map((slot) => slot.hex)}
              fallbackSrc={quoteProductPlaceholder}
              model={{
                name: activeItem.modelLabel,
                size: activeItem.modelSize,
                url: activeItem.modelURL,
              }}
            />
          </div>

          <div className="divide-y">
            <div className="flex items-center gap-4 px-5 py-4">
              <Layers3Icon className="size-5 text-primary/50" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">Material</p>
                <p className="text-sm text-primary/55">{draft.filamentLabel || 'Not selected'}</p>
              </div>
              {editable ? (
                <Button onClick={() => setMaterialOpen(true)} variant="outline">
                  {draft.filamentId ? 'Change' : 'Select'}
                </Button>
              ) : null}
            </div>

            <div className="px-5 py-4">
              <div className="flex items-center gap-4">
                <PaletteIcon className="size-5 text-primary/50" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">Colours</p>
                  <p className="text-sm text-primary/55">
                    {draft.sameColour ? 'One colour for the whole model' : 'Assigned by model slot'}
                  </p>
                </div>
                {editable && activeItem.modelSlotCount > 1 ? (
                  <div className="grid grid-cols-2 rounded-md border p-1">
                    <button
                      aria-pressed={draft.sameColour}
                      className={cn(
                        'rounded-sm px-3 py-2 text-sm',
                        draft.sameColour && 'bg-primary text-primary-foreground',
                      )}
                      onClick={() => setSameColour(true)}
                      type="button"
                    >
                      Same colour
                    </button>
                    <button
                      aria-pressed={!draft.sameColour}
                      className={cn(
                        'rounded-sm px-3 py-2 text-sm',
                        !draft.sameColour && 'bg-primary text-primary-foreground',
                      )}
                      onClick={() => setSameColour(false)}
                      type="button"
                    >
                      By slot
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="mt-4 space-y-3">
                {(draft.sameColour ? draft.slots.slice(0, 1) : draft.slots).map((slot, index) => (
                  <div className="rounded-md border p-3" key={index}>
                    <div className="flex items-center gap-3">
                      <span
                        className="size-8 shrink-0 rounded-sm border"
                        style={{ background: slot.hex }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          {draft.sameColour ? 'Whole model' : `Slot ${index + 1}`}
                        </p>
                        <p className="truncate text-sm text-primary/55">
                          {slot.colourLabel || 'No colour selected'}
                        </p>
                      </div>
                      {editable ? (
                        <Button
                          disabled={!draft.filamentId}
                          onClick={() => setColourSlot(index)}
                          size="sm"
                          variant="outline"
                        >
                          {slot.colourId ? 'Change' : 'Select'}
                        </Button>
                      ) : null}
                    </div>
                    {!draft.sameColour ? (
                      <div className="mt-3">
                        <Label htmlFor={`slot-description-${activeItem.id}-${index}`}>
                          What should this colour apply to?{' '}
                          <span className="font-normal">(optional)</span>
                        </Label>
                        <Input
                          className="mt-2"
                          disabled={!editable}
                          id={`slot-description-${activeItem.id}-${index}`}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              slots: current.slots.map((entry, slotIndex) =>
                                slotIndex === index
                                  ? { ...entry, description: event.target.value }
                                  : entry,
                              ),
                            }))
                          }
                          placeholder="e.g. body, logo, eyes"
                          value={slot.description}
                        />
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-4 px-5 py-4">
              <PrinterIcon className="size-5 text-primary/50" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">Print process</p>
                <p className="text-sm text-primary/55">{draft.processLabel || 'Not selected'}</p>
              </div>
              {editable ? (
                <Button onClick={() => setProcessOpen(true)} variant="outline">
                  {draft.processId ? 'Change' : 'Select'}
                </Button>
              ) : null}
            </div>
          </div>

          <div className="grid gap-5 border-t p-5 md:grid-cols-2">
            <div>
              <Label>Quantity</Label>
              {editable ? (
                <div className="mt-2 flex w-fit items-center rounded-md border">
                  <Button
                    disabled={draft.quantity <= 1}
                    onClick={() =>
                      setDraft((current) => ({ ...current, quantity: current.quantity - 1 }))
                    }
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    -
                  </Button>
                  <span className="w-12 text-center">{draft.quantity}</span>
                  <Button
                    onClick={() =>
                      setDraft((current) => ({ ...current, quantity: current.quantity + 1 }))
                    }
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    +
                  </Button>
                </div>
              ) : (
                <p className="mt-2">{draft.quantity}</p>
              )}
            </div>
            <div className={cn(slicingDirty && 'text-primary/45')}>
              <Label>Estimate</Label>
              {slicingDirty ? <p className="mt-1 text-xs">Based on saved setup</p> : null}
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <span className="inline-flex items-center gap-2">
                  <ClockIcon className="size-4" />
                  {activeItem.gcodeDuration !== null
                    ? formatDuration(activeItem.gcodeDuration)
                    : 'Pending'}
                </span>
                <span>
                  {activeItem.gcodeWeight !== null
                    ? formatWeight(activeItem.gcodeWeight)
                    : 'Pending'}
                </span>
              </div>
              {activeItem.gcodeStatus === 'failed' ? (
                <p className="mt-2 inline-flex items-center gap-2 text-sm text-red-600">
                  <AlertTriangleIcon className="size-4" />
                  Automatic estimate failed; manual review is available.
                </p>
              ) : null}
            </div>
          </div>

          <div className="border-t p-5">
            <Label htmlFor={`model-note-${activeItem.id}`}>Model note</Label>
            <Textarea
              className="mt-2"
              disabled={!editable}
              id={`model-note-${activeItem.id}`}
              onChange={(event) =>
                setDraft((current) => ({ ...current, modelNote: event.target.value }))
              }
              rows={3}
              value={draft.modelNote}
            />
          </div>

          {editable ? (
            <div className="sticky bottom-0 z-20 flex flex-wrap items-center justify-end gap-3 border-t bg-background/95 px-5 py-4 backdrop-blur">
              {saveError ? <p className="mr-auto text-sm text-red-600">{saveError}</p> : null}
              {dirty ? (
                <span className="mr-auto text-xs text-primary/50">Unapplied changes</span>
              ) : null}
              <Button disabled={!dirty || pending} onClick={discardDraft} variant="outline">
                Discard changes
              </Button>
              <Button disabled={!dirty || pending} onClick={applyDraft}>
                {pending ? 'Applying...' : 'Apply changes'}
              </Button>
            </div>
          ) : null}
        </main>
      </div>

      <OptionDialog
        description="Choosing a material clears colour assignments that may no longer be available."
        onSelect={(option) =>
          setDraft((current) =>
            current.filamentId === String(option.id)
              ? current
              : {
                  ...current,
                  filamentId: String(option.id),
                  filamentLabel: option.name,
                  slots: current.slots.map(() => ({ ...EMPTY_SLOT })),
                },
          )
        }
        open={materialOpen}
        options={materialOptions}
        selectedID={draft.filamentId}
        setOpen={setMaterialOpen}
        title="Choose a material"
      />
      <OptionDialog
        description="Choose the colour for this assignment."
        fallback={(option) => (
          <ColourOptionPreview
            className="h-16 w-full"
            option={option as AvailableSpoolOption['colour']}
          />
        )}
        onSelect={chooseColour}
        open={colourSlot !== null}
        options={availableColours}
        selectedID={
          colourSlot === null
            ? ''
            : (draft.sameColour ? draft.slots[0] : draft.slots[colourSlot])?.colourId || ''
        }
        setOpen={(open) => !open && setColourSlot(null)}
        title={
          draft.sameColour ? 'Choose a colour' : `Choose a colour for slot ${(colourSlot ?? 0) + 1}`
        }
      />
      <OptionDialog
        description="Choose the print process for this model."
        onSelect={(option) =>
          setDraft((current) => ({
            ...current,
            processId: String(option.id),
            processLabel: option.name,
          }))
        }
        open={processOpen}
        options={qualityOptions}
        selectedID={draft.processId}
        setOpen={setProcessOpen}
        title="Choose a print process"
      />
    </div>
  )
}
