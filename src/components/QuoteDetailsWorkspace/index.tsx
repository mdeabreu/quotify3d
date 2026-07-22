'use client'

import { ColourOptionPreview } from '@/components/ColourPreview'
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
  type AvailableOption,
  type AvailableSpoolOption,
} from '@/lib/spoolAvailability'
import type { QuoteStatus } from '@/payload-types'
import { useBranding } from '@/providers/Branding'
import { cn } from '@/utilities/cn'
import { FilePlus2Icon, Layers3Icon, PaletteIcon, PrinterIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  useEffect,
  useEffectEvent,
  useMemo,
  useReducer,
  useState,
  useTransition,
  type FormEvent,
} from 'react'
import {
  createDraft,
  draftToFormSlots,
  itemDraftReducer,
  normalizeDraftForApply,
  serializeDraft,
  serializeSlicingDraft,
} from './draft'
import type { QuoteDetailsWorkspaceProps } from './types'
import { OptionDialog } from './OptionDialog'
import { QuoteItemList } from './QuoteItemList'
import { EstimateSummary } from './EstimateSummary'
import { SubmissionDialog } from './SubmissionDialog'
import { QuoteItemEditor } from './QuoteItemEditor'

export type { QuoteWorkspaceItem, QuoteWorkspaceSlot, SaveQuoteItemResult } from './types'

const AUTO_REFRESH_INTERVAL_MS = 3000
const IN_PROGRESS = new Set(['queued', 'collecting-context', 'slicing', 'parsing'])
const TERMINAL = new Set(['sliced', 'failed'])
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

const QuoteDetailsWorkspaceState = ({
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
}: QuoteDetailsWorkspaceProps) => {
  const router = useRouter()
  const { quoteProductPlaceholder } = useBranding()
  const initialActiveID = items.some((item) => item.id === initialItemID)
    ? initialItemID
    : (items[0]?.id ?? '')
  const initialItem = items.find((item) => item.id === initialActiveID) ?? items[0]
  const [activeID, setActiveID] = useState(initialActiveID)
  const [draft, dispatchDraft] = useReducer(itemDraftReducer, initialItem, createDraft)
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
    dispatchDraft({ item: nextItem, type: 'reset' })
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
    dispatchDraft({ sameColour, type: 'set-same-colour' })
  }

  const applyDraft = () => {
    const submittedDraft = normalizeDraftForApply(draft)
    const formData = new FormData()
    formData.set('quoteID', String(quoteID))
    formData.set('itemID', activeItem.id)
    formData.set('email', email)
    formData.set('accessToken', accessToken)
    formData.set('filament', submittedDraft.filamentId)
    formData.set('process', submittedDraft.processId)
    formData.set('quantity', String(submittedDraft.quantity))
    formData.set('notes', submittedDraft.modelNote)
    formData.set('filamentSlots', JSON.stringify(draftToFormSlots(submittedDraft)))
    setSaveError(null)
    startTransition(async () => {
      const result = await saveItemAction(formData)
      if (!result.success) {
        setSaveError(result.error)
        return
      }
      dispatchDraft({
        item: {
          ...activeItem,
          filamentId: submittedDraft.filamentId,
          filamentLabel: submittedDraft.filamentLabel,
          filamentSlots: submittedDraft.slots,
          modelNote: submittedDraft.modelNote,
          processId: submittedDraft.processId,
          processLabel: submittedDraft.processLabel,
          quantity: submittedDraft.quantity,
        },
        type: 'reset',
      })
      setSavedDraft(serializeDraft(submittedDraft))
      router.refresh()
    })
  }

  const discardDraft = () => {
    const persisted = createDraft(activeItem)
    dispatchDraft({ item: activeItem, type: 'reset' })
    setSavedDraft(serializeDraft(persisted))
    setSaveError(null)
  }

  const chooseColour = (option: AvailableOption) => {
    dispatchDraft({
      option,
      slotIndex: draft.sameColour ? 0 : (colourSlot ?? 0),
      type: 'select-colour',
    })
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

          <QuoteItemList
            activeItemID={activeItem.id}
            currencyCode={currencyCode}
            items={items}
            onSelect={selectItem}
          />

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
              <SubmissionDialog
                accessToken={accessToken}
                canSubmit={canSubmit}
                currencyCode={currencyCode}
                email={email}
                items={items}
                quoteID={quoteID}
                quoteNotes={quoteNotes}
                submitForReviewAction={submitForReviewAction}
              />
            ) : null}
            {editable ? (
              <p
                aria-hidden={canSubmit}
                className={cn('mt-2 min-h-4 text-xs text-primary/50', canSubmit && 'invisible')}
              >
                Complete every item and wait for each estimate to finish.
              </p>
            ) : null}
          </div>
        </aside>

        <QuoteItemEditor
          accessToken={accessToken}
          colors={draft.slots.map((slot) => slot.hex)}
          editable={editable}
          email={email}
          fallbackSrc={quoteProductPlaceholder}
          item={activeItem}
          itemCount={items.length}
          quoteID={quoteID}
          removeItemAction={removeItemAction}
        >
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
                            dispatchDraft({
                              description: event.target.value,
                              slotIndex: index,
                              type: 'set-slot-description',
                            })
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

          <div className="grid gap-5 border-t p-5">
            <div>
              <Label>Quantity</Label>
              {editable ? (
                <div className="mt-2 flex w-fit items-center rounded-md border">
                  <Button
                    disabled={draft.quantity <= 1}
                    onClick={() =>
                      dispatchDraft({ quantity: draft.quantity - 1, type: 'set-quantity' })
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
                      dispatchDraft({ quantity: draft.quantity + 1, type: 'set-quantity' })
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
            <EstimateSummary item={activeItem} slicingDirty={slicingDirty} />
          </div>

          <div className="border-t p-5">
            <Label htmlFor={`model-note-${activeItem.id}`}>Model note</Label>
            <Textarea
              className="mt-2"
              disabled={!editable}
              id={`model-note-${activeItem.id}`}
              onChange={(event) =>
                dispatchDraft({ notes: event.target.value, type: 'set-model-note' })
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
        </QuoteItemEditor>
      </div>

      <OptionDialog
        description="Choosing a material clears colour assignments that may no longer be available."
        onSelect={(option) => dispatchDraft({ option, type: 'select-material' })}
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
        onSelect={(option) => dispatchDraft({ option, type: 'select-process' })}
        open={processOpen}
        options={qualityOptions}
        selectedID={draft.processId}
        setOpen={setProcessOpen}
        title="Choose a print process"
      />
    </div>
  )
}

export const QuoteDetailsWorkspace = (props: QuoteDetailsWorkspaceProps) => {
  const itemStateKey = props.items.map((item) => item.id).join('|')
  return <QuoteDetailsWorkspaceState key={itemStateKey} {...props} />
}
