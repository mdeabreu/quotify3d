'use client'

import { AddQuoteItemToCartButton } from '@/components/QuoteActions/AddQuoteItemToCartButton'
import { Price } from '@/components/Price'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/utilities/cn'
import { PencilIcon, Trash2Icon } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'

type QuoteOption = {
  id: number
  name: string
  description: string | null
  imageUrl: string | null
}

export type QuoteWorkspaceItem = {
  colourId: string
  colourLabel: string
  gcodePrice: number | null
  gcodeStatus: string | null
  id: string
  modelLabel: string
  productID?: number
  productSlug?: string
  processId: string
  processLabel: string
  quantity: number
  filamentId: string
  filamentLabel: string
}

type EditorStep = 'material' | 'colour' | 'quality'

type Props = {
  addModelsAction: (formData: FormData) => void | Promise<void>
  currencyCode?: string
  editable: boolean
  email?: string
  items: QuoteWorkspaceItem[]
  materialOptions: QuoteOption[]
  qualityOptions: QuoteOption[]
  colourOptions: QuoteOption[]
  quoteID: number
  refreshEstimatesAction: (formData: FormData) => void | Promise<void>
  removeItemAction: (formData: FormData) => void | Promise<void>
  saveItemAction: (formData: FormData) => void | Promise<void>
  submitForReviewAction: (formData: FormData) => void | Promise<void>
}

const steps: { id: EditorStep; label: string }[] = [
  { id: 'material', label: 'Material' },
  { id: 'colour', label: 'Colour' },
  { id: 'quality', label: 'Quality' },
]

const humanizeStatus = (status: string | null) => {
  if (!status) return null
  return status.replaceAll('-', ' ')
}

const OptionCard = ({
  onSelect,
  option,
  selected,
}: {
  onSelect: (value: string) => void
  option: QuoteOption
  selected: boolean
}) => (
  <button
    className={cn(
      'rounded-md border bg-card p-3 text-left transition hover:border-primary/60 hover:bg-primary/5',
      selected && 'border-primary bg-primary/10',
    )}
    onClick={() => onSelect(String(option.id))}
    type="button"
  >
    {option.imageUrl ? (
      <img
        alt={option.name}
        className="h-28 w-full rounded-sm border bg-background object-cover"
        src={option.imageUrl}
      />
    ) : (
      <div className="flex h-28 w-full items-center justify-center rounded-sm border bg-muted/40 text-xs font-mono uppercase tracking-wider text-primary/50">
        Preview unavailable
      </div>
    )}

    <p className="mt-3 font-medium">{option.name}</p>
    {option.description ? <p className="mt-1 line-clamp-2 text-sm text-primary/70">{option.description}</p> : null}
  </button>
)

const QuoteItemEditorDialog = ({
  colourOptions,
  currencyCode,
  email = '',
  item,
  materialOptions,
  qualityOptions,
  quoteID,
  saveItemAction,
  trigger,
}: {
  colourOptions: QuoteOption[]
  currencyCode?: string
  email?: string
  item: QuoteWorkspaceItem
  materialOptions: QuoteOption[]
  qualityOptions: QuoteOption[]
  quoteID: number
  saveItemAction: (formData: FormData) => void | Promise<void>
  trigger: ReactNode
}) => {
  const [activeStep, setActiveStep] = useState<EditorStep>('material')
  const [quantity, setQuantity] = useState(item.quantity)
  const [filamentId, setFilamentId] = useState(item.filamentId)
  const [filamentLabel, setFilamentLabel] = useState(item.filamentLabel)
  const [colourId, setColourId] = useState(item.colourId)
  const [colourLabel, setColourLabel] = useState(item.colourLabel)
  const [processId, setProcessId] = useState(item.processId)
  const [processLabel, setProcessLabel] = useState(item.processLabel)

  const materialByID = useMemo(
    () => new Map(materialOptions.map((option) => [String(option.id), option] as const)),
    [materialOptions],
  )
  const colourByID = useMemo(
    () => new Map(colourOptions.map((option) => [String(option.id), option] as const)),
    [colourOptions],
  )
  const qualityByID = useMemo(
    () => new Map(qualityOptions.map((option) => [String(option.id), option] as const)),
    [qualityOptions],
  )

  const selectedMaterial = materialByID.get(filamentId)
  const selectedColour = colourByID.get(colourId)
  const selectedQuality = qualityByID.get(processId)

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{item.modelLabel}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-[120px]">
              <p className="text-xs font-mono uppercase tracking-widest text-primary/50">Quantity</p>
              <Input
                aria-label={`Quantity for ${item.modelLabel}`}
                className="mt-2"
                min={1}
                onChange={(event) => {
                  const nextQuantity = Number.parseInt(event.target.value, 10)
                  setQuantity(Number.isInteger(nextQuantity) && nextQuantity >= 1 ? nextQuantity : 1)
                }}
                type="number"
                value={quantity}
              />
            </div>

            <div className="rounded-full border px-3 py-2 text-right">
              {typeof item.gcodePrice === 'number' ? (
                <Price
                  amount={item.gcodePrice * quantity}
                  as="p"
                  className="text-sm font-medium"
                  currencyCode={currencyCode}
                />
              ) : (
                <p className="text-sm text-primary/70">Estimate in progress</p>
              )}
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-3">
            {steps.map((step) => (
              <button
                key={step.id}
                className={cn(
                  'rounded-md border px-4 py-2.5 text-center transition hover:border-primary/60',
                  activeStep === step.id && 'border-primary bg-primary/5',
                )}
                onClick={() => setActiveStep(step.id)}
                type="button"
              >
                <p className="font-medium">{step.label}</p>
              </button>
            ))}
          </div>

          {activeStep === 'material' ? (
            <div className="grid gap-3 md:grid-cols-2">
              {materialOptions.map((option) => (
                <OptionCard
                  key={option.id}
                  onSelect={(value) => {
                    setFilamentId(value)
                    setFilamentLabel(materialByID.get(value)?.name ?? filamentLabel)
                  }}
                  option={option}
                  selected={filamentId === String(option.id)}
                />
              ))}
            </div>
          ) : null}

          {activeStep === 'colour' ? (
            <div className="grid gap-3 md:grid-cols-2">
              {colourOptions.map((option) => (
                <OptionCard
                  key={option.id}
                  onSelect={(value) => {
                    setColourId(value)
                    setColourLabel(colourByID.get(value)?.name ?? colourLabel)
                  }}
                  option={option}
                  selected={colourId === String(option.id)}
                />
              ))}
            </div>
          ) : null}

          {activeStep === 'quality' ? (
            <div className="grid gap-3 md:grid-cols-2">
              {qualityOptions.map((option) => (
                <OptionCard
                  key={option.id}
                  onSelect={(value) => {
                    setProcessId(value)
                    setProcessLabel(qualityByID.get(value)?.name ?? processLabel)
                  }}
                  option={option}
                  selected={processId === String(option.id)}
                />
              ))}
            </div>
          ) : null}

          <form
            action={saveItemAction}
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card p-3"
          >
            <input name="quoteID" type="hidden" value={quoteID} />
            <input name="itemID" type="hidden" value={item.id} />
            <input name="quantity" type="hidden" value={quantity} />
            <input name="filament" type="hidden" value={filamentId} />
            <input name="colour" type="hidden" value={colourId} />
            <input name="process" type="hidden" value={processId} />
            {email ? <input name="email" type="hidden" value={email} /> : null}

            <div className="min-w-0 flex-1 text-sm text-primary/70">
              <p className="truncate">
                {selectedMaterial?.name ?? filamentLabel} · {selectedColour?.name ?? colourLabel} ·{' '}
                {selectedQuality?.name ?? processLabel} · Qty {quantity}
              </p>
            </div>

            <Button size="sm" type="submit">
              Save
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export const QuoteDetailsWorkspace = ({
  addModelsAction,
  colourOptions,
  currencyCode,
  editable,
  email = '',
  items,
  materialOptions,
  qualityOptions,
  quoteID,
  refreshEstimatesAction,
  removeItemAction,
  saveItemAction,
  submitForReviewAction,
}: Props) => {
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <div className="space-y-6">
      {editable ? (
        <form action={addModelsAction} className="rounded-xl border border-dashed bg-background/70 p-4">
          <input name="quoteID" type="hidden" value={quoteID} />
          <input
            name="filament"
            type="hidden"
            value={items[0]?.filamentId ?? String(materialOptions[0]?.id ?? '')}
          />
          <input
            name="colour"
            type="hidden"
            value={items[0]?.colourId ?? String(colourOptions[0]?.id ?? '')}
          />
          <input
            name="process"
            type="hidden"
            value={items[0]?.processId ?? String(qualityOptions[0]?.id ?? '')}
          />
          {email ? <input name="email" type="hidden" value={email} /> : null}

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Add more files</p>
                <p className="mt-1 text-xs text-primary/60">
                  Accepted formats: STL, 3MF, OBJ, STEP, STP, AMF, PLY
                </p>
              </div>
              <p className="text-sm text-primary/70">
                {items.length} file{items.length === 1 ? '' : 's'} · {totalQuantity} total item
                {totalQuantity === 1 ? '' : 's'}
              </p>
            </div>

            <Input accept=".stl,.3mf,.obj,.step,.stp,.amf,.ply" multiple name="files" type="file" />

            <Button className="w-full sm:w-auto" size="sm" type="submit">
              Upload files
            </Button>
          </div>
        </form>
      ) : null}

      {items.length > 0 ? (
        <ul className="flex flex-col gap-6">
          {items.map((item) => {
            const canRemove = editable && items.length > 1
            const subtotal = typeof item.gcodePrice === 'number' ? item.gcodePrice * item.quantity : null
            const statusLabel = humanizeStatus(item.gcodeStatus)

            return (
              <li key={item.id}>
                <div className="flex flex-col gap-6 rounded-lg border bg-card px-4 py-3 md:px-6 md:py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-medium">
                        {item.productSlug ? (
                          <Link href={`/products/${item.productSlug}`}>{item.modelLabel}</Link>
                        ) : (
                          item.modelLabel
                        )}
                      </h3>

                      {statusLabel ? (
                        <p className="rounded-full bg-background px-2 py-0.5 text-xs font-mono uppercase tracking-widest text-primary/55">
                          {statusLabel}
                        </p>
                      ) : null}
                    </div>

                    <div className="text-sm font-mono tracking-widest text-primary/50">
                      <p>{item.filamentLabel}</p>
                      <p>{item.colourLabel}</p>
                      <p>{item.processLabel}</p>
                    </div>

                    <div>x{item.quantity}</div>
                  </div>

                  <div className="flex flex-col gap-3 sm:items-end">
                    <div className="text-right">
                      <p className="text-lg font-medium">Subtotal</p>
                      {typeof subtotal === 'number' ? (
                        <Price
                          amount={subtotal}
                          className="text-sm font-mono text-primary/50"
                          currencyCode={currencyCode}
                        />
                      ) : (
                        <p className="text-sm font-mono text-primary/50">Estimate in progress</p>
                      )}
                    </div>

                    {typeof item.productID === 'number' ? (
                      <AddQuoteItemToCartButton productID={item.productID} quantity={item.quantity} />
                    ) : null}

                    {editable ? (
                      <div className="flex flex-wrap gap-2">
                        <QuoteItemEditorDialog
                          colourOptions={colourOptions}
                          currencyCode={currencyCode}
                          email={email}
                          item={item}
                          materialOptions={materialOptions}
                          qualityOptions={qualityOptions}
                          quoteID={quoteID}
                          saveItemAction={saveItemAction}
                          trigger={
                            <Button size="icon" variant="outline">
                              <PencilIcon className="size-4" />
                              <span className="sr-only">Edit item</span>
                            </Button>
                          }
                        />

                        <form action={removeItemAction}>
                          <input name="quoteID" type="hidden" value={quoteID} />
                          <input name="itemID" type="hidden" value={item.id} />
                          {email ? <input name="email" type="hidden" value={email} /> : null}
                          <Button disabled={!canRemove} size="icon" type="submit" variant="outline">
                            <Trash2Icon className="size-4" />
                            <span className="sr-only">Remove item</span>
                          </Button>
                        </form>
                      </div>
                    ) : null}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="rounded-lg border border-dashed bg-background/70 px-4 py-10 text-center text-sm text-primary/70">
          No files added yet.
        </div>
      )}

      {editable ? (
        <div className="flex flex-wrap justify-end gap-3 border-t pt-4">
          <form action={refreshEstimatesAction}>
            <input name="quoteID" type="hidden" value={quoteID} />
            {email ? <input name="email" type="hidden" value={email} /> : null}
            <Button size="sm" type="submit" variant="outline">
              Refresh estimate
            </Button>
          </form>

          <form action={submitForReviewAction}>
            <input name="quoteID" type="hidden" value={quoteID} />
            {email ? <input name="email" type="hidden" value={email} /> : null}
            <Button size="sm" type="submit">
              Send for review
            </Button>
          </form>
        </div>
      ) : null}
    </div>
  )
}
