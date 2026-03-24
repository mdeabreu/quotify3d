'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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

type QuoteOption = {
  id: number
  name: string
  description: string | null
  imageUrl: string | null
}

type QuoteOptionsResponse = {
  colours: QuoteOption[]
  filaments: QuoteOption[]
  processes: QuoteOption[]
}

type RestFindResponse<T> = {
  docs: T[]
}

type ModelLine = {
  file: File
  quantity: number
}

type OptionCardProps = {
  onSelect: (value: string) => void
  option: QuoteOption
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

const normalizeOption = (option: QuoteOptionResponse): QuoteOption => {
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

const OptionCard: React.FC<OptionCardProps> = ({ onSelect, option, selected }) => {
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
    colours: [],
    filaments: [],
    processes: [],
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

        const [filamentsResponse, coloursResponse, processesResponse] = await Promise.all([
          fetch(`/api/filaments${query}`, { method: 'GET', credentials: 'include' }),
          fetch(`/api/colours${query}`, { method: 'GET', credentials: 'include' }),
          fetch(`/api/processes${query}`, { method: 'GET', credentials: 'include' }),
        ])

        if (!filamentsResponse.ok || !coloursResponse.ok || !processesResponse.ok) {
          throw new Error('Unable to load quote options.')
        }

        const [filamentsJSON, coloursJSON, processesJSON] = await Promise.all([
          filamentsResponse.json() as Promise<RestFindResponse<QuoteOptionResponse>>,
          coloursResponse.json() as Promise<RestFindResponse<QuoteOptionResponse>>,
          processesResponse.json() as Promise<RestFindResponse<QuoteOptionResponse>>,
        ])

        setOptions({
          filaments: (filamentsJSON.docs ?? []).map(normalizeOption),
          colours: (coloursJSON.docs ?? []).map(normalizeOption),
          processes: (processesJSON.docs ?? []).map(normalizeOption),
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
      return Boolean(colour)
    }

    if (step === 3) {
      return Boolean(process)
    }

    if (authLoading) return false
    if (!isGuest) return true

    return EMAIL_REGEX.test(customerEmail.trim())
  }, [authLoading, colour, customerEmail, filament, isGuest, modelLines, process, step])

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

    if (!canContinue || step !== 4) {
      setError('Please complete all steps before submitting.')
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

      if (!quoteID) throw new Error('Quote creation response is missing an ID.')

      toast.success('Quote request created. Opening your workspace...')
      router.push(
        isGuest ? `/quotes/${quoteID}?email=${encodeURIComponent(normalizedEmail)}` : `/quotes/${quoteID}`,
      )
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Unable to create quote.'
      setError(message)
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedFilament = options.filaments.find((option) => String(option.id) === filament)
  const selectedColour = options.colours.find((option) => String(option.id) === colour)
  const selectedProcess = options.processes.find((option) => String(option.id) === process)

  return (
    <section className="border rounded-lg bg-card p-6 md:p-8">
      <div className="max-w-3xl">
        <p className="text-xs uppercase tracking-widest font-mono text-primary/60">Quote Wizard</p>
        <h1 className="text-3xl md:text-4xl font-medium mt-2">Request a 3D print quote</h1>
        <p className="text-primary/70 mt-4">
          Upload your files, choose your preferred material, color, and print quality, then confirm
          your contact details so we can prepare your quote.
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
              Add one or more 3D model files. You can set a quantity for each file before continuing.
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
            <p className="text-sm text-primary/70">This selection will apply to every file in this quote.</p>

            {isLoadingOptions ? (
              <p className="text-sm text-primary/70">Loading materials...</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {options.filaments.map((option) => (
                  <OptionCard
                    key={option.id}
                    onSelect={setFilament}
                    option={option}
                    selected={String(option.id) === filament}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="font-medium">Choose a color</h2>
            <p className="text-sm text-primary/70">This selection will apply to every file in this quote.</p>

            {isLoadingOptions ? (
              <p className="text-sm text-primary/70">Loading colors...</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {options.colours.map((option) => (
                  <OptionCard
                    key={option.id}
                    onSelect={setColour}
                    option={option}
                    selected={String(option.id) === colour}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="font-medium">Choose print quality</h2>
            <p className="text-sm text-primary/70">This selection will apply to every file in this quote.</p>

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
            <h2 className="font-medium">Review your request</h2>
            <p className="text-sm text-primary/70">
              Double-check your files and selections, then confirm how we should contact you.
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
                <span className="font-mono uppercase text-primary/50 text-xs mr-2">Print quality</span>
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
                  We will use this email to send updates and help you return to this quote later.
                </p>
              </div>
            ) : (
              <p className="text-sm text-primary/70">
                Signed in as <span className="font-medium">{user.email}</span>. This quote request
                will be saved to your account.
              </p>
            )}

            <p className="text-xs text-primary/60">
              Once submitted, we will process your files and generate an estimated price as soon as it
              is ready.
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
            {isSubmitting ? 'Submitting request...' : 'Submit quote request'}
          </Button>
        )}
      </div>
    </section>
  )
}
