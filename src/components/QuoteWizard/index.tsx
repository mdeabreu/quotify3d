'use client'

import { Price } from '@/components/Price'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  buildAvailableSpoolOptions,
  findSpoolForPair,
  uniqueOptions,
  type AvailableOption,
  type AvailableSpoolOption,
} from '@/lib/spoolAvailability'
import { useAuth } from '@/providers/Auth'
import { cn } from '@/utilities/cn'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

type WizardStep = 0 | 1 | 2 | 3 | 4

type QuoteOptionResponse = {
  id: number
  name: string
  description?: string | null
  image?:
    | {
        url?: string | null
        thumbnailURL?: string | null
      }
    | number
    | null
}

type QuoteOptionsResponse = {
  processes: AvailableOption[]
  spools: AvailableSpoolOption[]
}

type RestFindResponse<T> = {
  docs: T[]
}

type ModelLine = {
  file: File
  quantity: number
}

type OptionCardProps = {
  showMaterialPrice?: boolean
  onSelect: (value: string) => void
  option: AvailableOption
  selected: boolean
}

const steps = ['Upload files', 'Material', 'Color', 'Print quality', 'Contact']
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const shortenDescription = (description: string | null): string | null => {
  if (!description || !description.trim()) return null

  const normalized = description.trim()
  if (normalized.length <= 120) return normalized

  return `${normalized.slice(0, 117).trimEnd()}...`
}

const toAbsoluteURL = (value: string): string => {
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value
  }

  const base = process.env.NEXT_PUBLIC_SERVER_URL ?? ''
  if (!base) return value

  return `${base}${value}`
}

const normalizeOption = (option: QuoteOptionResponse): AvailableOption => {
  let imageUrl: string | null = null

  if (option.image && typeof option.image === 'object') {
    const candidate = option.image.thumbnailURL || option.image.url

    if (typeof candidate === 'string' && candidate.length > 0) {
      imageUrl = toAbsoluteURL(candidate)
    }
  }

  return {
    id: option.id,
    name: option.name,
    description: typeof option.description === 'string' ? option.description : null,
    imageUrl,
  }
}

const OptionCard: React.FC<OptionCardProps> = ({
  showMaterialPrice = false,
  onSelect,
  option,
  selected,
}) => {
  return (
    <button
      className={cn(
        'text-left rounded-md border bg-card p-3 transition hover:border-primary/60 hover:bg-primary/5',
        selected && 'border-primary bg-primary/10',
      )}
      onClick={() => onSelect(String(option.id))}
      type="button"
    >
      {option.imageUrl ? (
        <img
          alt={option.name}
          className="h-32 w-full rounded-sm border object-cover bg-background"
          src={option.imageUrl}
        />
      ) : (
        <div className="h-32 w-full rounded-sm border bg-muted/40 flex items-center justify-center text-xs font-mono uppercase tracking-wider text-primary/50">
          Preview unavailable
        </div>
      )}

      <p className="mt-3 font-medium">{option.name}</p>
      {showMaterialPrice && typeof option.pricePerGram === 'number' ? (
        <p className="mt-1 text-sm text-primary/70">
          <Price amount={option.pricePerGram} as="span" className="font-medium" /> / gram
        </p>
      ) : null}
      {shortenDescription(option.description) ? (
        <p className="mt-1 text-sm text-primary/70">{shortenDescription(option.description)}</p>
      ) : null}
    </button>
  )
}

export const QuoteWizard = () => {
  const router = useRouter()
  const { user } = useAuth()

  const [step, setStep] = useState<WizardStep>(0)
  const [isLoadingOptions, setIsLoadingOptions] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [options, setOptions] = useState<QuoteOptionsResponse>({
    processes: [],
    spools: [],
  })

  const [customerEmail, setCustomerEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [filament, setFilament] = useState('')
  const [colour, setColour] = useState('')
  const [process, setProcess] = useState('')
  const [modelLines, setModelLines] = useState<ModelLine[]>([])

  const [error, setError] = useState<string | null>(null)

  const isGuest = user === null
  const authLoading = typeof user === 'undefined'

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const query = '?depth=1&limit=200&pagination=false&sort=name&where[active][equals]=true'
        const spoolQuery = '?depth=2&limit=500&pagination=false&sort=id&where[active][equals]=true'

        const [spoolsResponse, processesResponse] = await Promise.all([
          fetch(`/api/spools${spoolQuery}`, { method: 'GET', credentials: 'include' }),
          fetch(`/api/processes${query}`, { method: 'GET', credentials: 'include' }),
        ])

        if (!spoolsResponse.ok || !processesResponse.ok) {
          throw new Error('Unable to load quote options.')
        }

        const [spoolsJSON, processesJSON] = await Promise.all([
          spoolsResponse.json() as Promise<
            RestFindResponse<Parameters<typeof buildAvailableSpoolOptions>[0][number]>
          >,
          processesResponse.json() as Promise<RestFindResponse<QuoteOptionResponse>>,
        ])

        setOptions({
          processes: (processesJSON.docs ?? []).map(normalizeOption),
          spools: buildAvailableSpoolOptions(spoolsJSON.docs ?? []),
        })
      } catch (loadError) {
        console.error(loadError)
        setError('Unable to load quote options right now. Please refresh and try again.')
      } finally {
        setIsLoadingOptions(false)
      }
    }

    void loadOptions()
  }, [])

  const selectedSpool = useMemo(
    () =>
      findSpoolForPair(options.spools, {
        colour,
        filament,
      }),
    [colour, filament, options.spools],
  )

  const availableMaterials = useMemo(() => {
    const colourID = Number.parseInt(colour, 10)

    return uniqueOptions(
      Number.isInteger(colourID)
        ? options.spools.filter((spool) => spool.colour.id === colourID)
        : options.spools,
      'filament',
    )
  }, [colour, options.spools])

  const availableColours = useMemo(() => {
    const filamentID = Number.parseInt(filament, 10)

    return uniqueOptions(
      Number.isInteger(filamentID)
        ? options.spools.filter((spool) => spool.filament.id === filamentID)
        : options.spools,
      'colour',
    )
  }, [filament, options.spools])

  const canContinue = useMemo(() => {
    if (step === 0) {
      return (
        modelLines.length > 0 &&
        modelLines.every((line) => Number.isInteger(line.quantity) && line.quantity >= 1)
      )
    }

    if (step === 1) {
      return Boolean(filament)
    }

    if (step === 2) {
      return Boolean(colour && selectedSpool)
    }

    if (step === 3) {
      return Boolean(process)
    }

    if (authLoading) return false
    if (!isGuest) return true

    return EMAIL_REGEX.test(customerEmail.trim())
  }, [
    authLoading,
    colour,
    customerEmail,
    filament,
    isGuest,
    modelLines,
    process,
    selectedSpool,
    step,
  ])

  const onSelectFiles = (fileList: FileList | null) => {
    if (!fileList) return

    const nextLines: ModelLine[] = Array.from(fileList)
      .filter((file) => file.size > 0)
      .map((file) => ({
        file,
        quantity: 1,
      }))

    setModelLines(nextLines)
  }

  const updateQuantity = (index: number, quantityValue: string) => {
    const quantity = Number.parseInt(quantityValue, 10)

    setModelLines((previous) =>
      previous.map((line, lineIndex) => {
        if (lineIndex !== index) return line

        return {
          ...line,
          quantity: Number.isInteger(quantity) && quantity >= 1 ? quantity : 1,
        }
      }),
    )
  }

  const removeLine = (index: number) => {
    setModelLines((previous) => previous.filter((_, lineIndex) => lineIndex !== index))
  }

  const goToNextStep = () => {
    if (!canContinue) {
      setError('Please complete the required fields before continuing.')
      return
    }

    setError(null)
    setStep((previous) => Math.min(previous + 1, 4) as WizardStep)
  }

  const goToPreviousStep = () => {
    setError(null)
    setStep((previous) => Math.max(previous - 1, 0) as WizardStep)
  }

  const submitWizard = async () => {
    setError(null)

    if (!canContinue || step !== 4 || !selectedSpool) {
      setError('Please complete all steps before continuing.')
      return
    }

    setIsSubmitting(true)

    try {
      const normalizedEmail = customerEmail.trim().toLowerCase()
      const guestEmailPayload = normalizedEmail ? { customerEmail: normalizedEmail } : {}
      const modelIDs: number[] = []

      for (const line of modelLines) {
        const modelForm = new FormData()
        modelForm.append('file', line.file)

        if (normalizedEmail) {
          modelForm.append(
            '_payload',
            JSON.stringify({
              customerEmail: normalizedEmail,
            }),
          )
        }

        const modelResponse = await fetch('/api/models', {
          method: 'POST',
          credentials: 'include',
          body: modelForm,
        })

        const modelJSON = await modelResponse.json().catch(() => ({}))
        if (!modelResponse.ok) {
          throw new Error(
            typeof modelJSON?.errors?.[0]?.message === 'string'
              ? modelJSON.errors[0].message
              : typeof modelJSON.error === 'string'
                ? modelJSON.error
                : 'Unable to upload model files.',
          )
        }

        const modelID =
          typeof modelJSON?.doc?.id === 'number'
            ? modelJSON.doc.id
            : typeof modelJSON?.id === 'number'
              ? modelJSON.id
              : null

        if (!modelID) {
          throw new Error('Model upload response is missing an ID.')
        }

        modelIDs.push(modelID)
      }

      const quotePayload = {
        status: 'queued',
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...guestEmailPayload,
        items: modelLines.map((line, index) => ({
          model: modelIDs[index],
          quantity: line.quantity,
          spool: selectedSpool.id,
          filament: Number.parseInt(filament, 10),
          colour: Number.parseInt(colour, 10),
          process: Number.parseInt(process, 10),
        })),
      }

      const quoteResponse = await fetch('/api/quotes', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(quotePayload),
      })

      const quoteJSON = await quoteResponse.json().catch(() => ({}))
      if (!quoteResponse.ok) {
        throw new Error(
          typeof quoteJSON?.errors?.[0]?.message === 'string'
            ? quoteJSON.errors[0].message
            : typeof quoteJSON.error === 'string'
              ? quoteJSON.error
              : 'Unable to create quote.',
        )
      }

      const quoteID =
        typeof quoteJSON?.doc?.id === 'number'
          ? quoteJSON.doc.id
          : typeof quoteJSON?.id === 'number'
            ? quoteJSON.id
            : null
      const quoteAccessToken =
        typeof quoteJSON?.doc?.accessToken === 'string'
          ? quoteJSON.doc.accessToken
          : typeof quoteJSON?.accessToken === 'string'
            ? quoteJSON.accessToken
            : null

      if (!quoteID) throw new Error('Quote creation response is missing an ID.')
      if (isGuest && !quoteAccessToken) {
        throw new Error('Quote creation response is missing an access token.')
      }

      toast.success('Quote draft created. Opening your workspace...')
      router.push(
        isGuest
          ? `/quotes/${quoteID}?email=${encodeURIComponent(normalizedEmail)}&accessToken=${encodeURIComponent(quoteAccessToken || '')}`
          : `/quotes/${quoteID}`,
      )
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Unable to create quote.'
      setError(message)
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedFilament = availableMaterials.find((option) => String(option.id) === filament)
  const selectedColour = availableColours.find((option) => String(option.id) === colour)
  const selectedProcess = options.processes.find((option) => String(option.id) === process)

  const selectFilament = (value: string) => {
    setFilament(value)

    if (colour && !findSpoolForPair(options.spools, { colour, filament: value })) {
      setColour('')
    }
  }

  const selectColour = (value: string) => {
    setColour(value)

    if (filament && !findSpoolForPair(options.spools, { colour: value, filament })) {
      setFilament('')
    }
  }

  return (
    <section className="border rounded-lg bg-card p-6 md:p-8">
      <div className="max-w-3xl">
        <p className="text-xs uppercase tracking-widest font-mono text-primary/60">Quote Wizard</p>
        <h1 className="text-3xl md:text-4xl font-medium mt-2">Request a 3D print quote</h1>
        <p className="text-primary/70 mt-4">
          Upload your files, choose starting options for every model, then continue to your quote
          workspace to review and edit each file before sending it for review.
        </p>
      </div>

      <ol className="mt-8 grid gap-3 md:grid-cols-5">
        {steps.map((stepLabel, index) => (
          <li
            key={stepLabel}
            className={cn('rounded-md border bg-background px-4 py-3', {
              'border-primary': index === step,
            })}
          >
            <p className="text-xs uppercase tracking-wider font-mono text-primary/50">
              Step {index + 1}
            </p>
            <p className="mt-1 text-sm">{stepLabel}</p>
          </li>
        ))}
      </ol>

      <div className="mt-8 rounded-md border bg-background p-4 md:p-6 space-y-4">
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="font-medium">Upload your files</h2>
            <p className="text-sm text-primary/70">
              Add one or more 3D model files. You can set a quantity for each file before
              continuing.
            </p>
            <Input
              accept=".stl,.3mf,.obj,.step,.stp,.amf,.ply"
              multiple
              onChange={(event) => onSelectFiles(event.target.files)}
              type="file"
            />

            {modelLines.length > 0 && (
              <ul className="space-y-3">
                {modelLines.map((line, index) => (
                  <li
                    className="rounded-md border px-3 py-3"
                    key={`${line.file.name}-${line.file.size}-${index}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-medium break-all">{line.file.name}</p>
                        <p className="text-xs text-primary/60">
                          {(line.file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Label htmlFor={`quantity-${index}`}>Quantity</Label>
                        <Input
                          className="w-24"
                          id={`quantity-${index}`}
                          min={1}
                          onChange={(event) => updateQuantity(index, event.target.value)}
                          type="number"
                          value={line.quantity}
                        />
                        <Button
                          onClick={() => removeLine(index)}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <h2 className="font-medium">Choose a material</h2>
            <p className="text-sm text-primary/70">
              This starting selection will apply to every file. You can adjust individual files in
              the quote workspace next.
            </p>

            {isLoadingOptions ? (
              <p className="text-sm text-primary/70">Loading materials...</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {availableMaterials.map((option) => (
                  <OptionCard
                    key={option.id}
                    onSelect={selectFilament}
                    option={option}
                    selected={String(option.id) === filament}
                    showMaterialPrice
                  />
                ))}
              </div>
            )}
            {!isLoadingOptions && availableMaterials.length === 0 ? (
              <p className="text-sm text-primary/70">
                No materials are available for the selected color.
              </p>
            ) : null}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="font-medium">Choose a color</h2>
            <p className="text-sm text-primary/70">
              This starting selection will apply to every file. You can adjust individual files in
              the quote workspace next.
            </p>

            {isLoadingOptions ? (
              <p className="text-sm text-primary/70">Loading colors...</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {availableColours.map((option) => (
                  <OptionCard
                    key={option.id}
                    onSelect={selectColour}
                    option={option}
                    selected={String(option.id) === colour}
                  />
                ))}
              </div>
            )}
            {!isLoadingOptions && availableColours.length === 0 ? (
              <p className="text-sm text-primary/70">
                No colors are available for the selected material.
              </p>
            ) : null}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="font-medium">Choose print quality</h2>
            <p className="text-sm text-primary/70">
              This starting selection will apply to every file. You can adjust individual files in
              the quote workspace next.
            </p>

            {isLoadingOptions ? (
              <p className="text-sm text-primary/70">Loading quality options...</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {options.processes.map((option) => (
                  <OptionCard
                    key={option.id}
                    onSelect={setProcess}
                    option={option}
                    selected={String(option.id) === process}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h2 className="font-medium">Review your starting options</h2>
            <p className="text-sm text-primary/70">
              Double-check your files and selections, then continue to the quote workspace for
              detailed edits and final review.
            </p>

            <div className="rounded-md border px-4 py-3">
              <p className="text-xs uppercase tracking-widest font-mono text-primary/50">Files</p>
              <ul className="mt-2 space-y-1 text-sm">
                {modelLines.map((line, index) => (
                  <li key={`${line.file.name}-${line.file.size}-${index}`}>
                    {line.file.name} x{line.quantity}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-md border px-4 py-3 text-sm space-y-1">
              <p>
                <span className="font-mono uppercase text-primary/50 text-xs mr-2">Material</span>
                {selectedFilament?.name ?? 'Not selected'}
              </p>
              <p>
                <span className="font-mono uppercase text-primary/50 text-xs mr-2">Color</span>
                {selectedColour?.name ?? 'Not selected'}
              </p>
              <p>
                <span className="font-mono uppercase text-primary/50 text-xs mr-2">
                  Print quality
                </span>
                {selectedProcess?.name ?? 'Not selected'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Any context, deadlines, or requirements..."
                rows={4}
                value={notes}
              />
            </div>

            {authLoading ? (
              <p className="text-sm text-primary/70">Checking session...</p>
            ) : isGuest ? (
              <div className="space-y-2">
                <Label htmlFor="customerEmail">Contact email</Label>
                <Input
                  id="customerEmail"
                  onChange={(event) => setCustomerEmail(event.target.value)}
                  placeholder="you@example.com"
                  type="email"
                  value={customerEmail}
                />
                <p className="text-xs text-primary/60">
                  We will use this email to help you return to the quote workspace and receive
                  updates later.
                </p>
              </div>
            ) : (
              <p className="text-sm text-primary/70">
                Signed in as <span className="font-medium">{user.email}</span>. This quote request
                will be saved to your account.
              </p>
            )}

            <p className="text-xs text-primary/60">
              After you continue, we will start processing your files and show estimates in the
              quote workspace as soon as they are ready.
            </p>
          </div>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Button asChild variant="outline">
          <Link href="/quotes">Back to quotes</Link>
        </Button>

        {step > 0 && (
          <Button onClick={goToPreviousStep} type="button" variant="outline">
            Previous
          </Button>
        )}

        {step < 4 && (
          <Button
            disabled={
              !canContinue || ((step === 1 || step === 2 || step === 3) && isLoadingOptions)
            }
            onClick={goToNextStep}
            type="button"
          >
            Continue
          </Button>
        )}

        {step === 4 && (
          <Button disabled={isSubmitting || !canContinue} onClick={submitWizard} type="button">
            {isSubmitting ? 'Continuing...' : 'Continue to quote workspace'}
          </Button>
        )}
      </div>
    </section>
  )
}
