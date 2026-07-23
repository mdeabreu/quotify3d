'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  getUnsupportedModelFilesMessage,
  getUnsupportedModelFilenames,
  MODEL_UPLOAD_ACCEPT,
  MODEL_UPLOAD_FORMAT_LABEL,
} from '@/lib/modelUploadFormats'
import { useAuth } from '@/providers/Auth'
import { FileUpIcon, UserIcon } from 'lucide-react'
import Link from 'next/link'
import { useActionState, useState } from 'react'

export type StartQuoteState = { error?: string }

type Props = {
  startQuoteAction: (state: StartQuoteState, formData: FormData) => Promise<StartQuoteState>
}

export const QuoteWizard = ({ startQuoteAction }: Props) => {
  const { user } = useAuth()
  const [state, action, pending] = useActionState(startQuoteAction, {})
  const [filename, setFilename] = useState('')
  const [fileError, setFileError] = useState<string | null>(null)

  return (
    <section className="mx-auto max-w-5xl rounded-lg border bg-card">
      <div className="border-b px-6 py-8 text-center md:px-10">
        <h1 className="text-3xl font-medium">Start your quote</h1>
        <p className="mt-2 text-primary/65">
          Upload a 3D model and add your email. Next, choose your material, colours, and print
          profile.
        </p>
      </div>

      <form action={action} className="grid md:grid-cols-2">
        <div className="border-b p-6 md:border-r md:border-b-0 md:p-10">
          <div className="flex items-start gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full border text-sm">
              1
            </span>
            <div>
              <h2 className="font-medium">Add your first model</h2>
              <p className="mt-1 text-sm text-primary/60">
                Accepted formats: {MODEL_UPLOAD_FORMAT_LABEL}
              </p>
            </div>
          </div>

          <Label
            className="mt-6 flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed bg-background px-6 text-center transition hover:border-primary/60"
            htmlFor="quote-model"
          >
            <FileUpIcon className="size-9 text-primary/50" />
            <span className="mt-4 font-medium">Choose a 3D model</span>
            <span className="mt-1 max-w-full break-all text-sm text-primary/60">
              {filename || 'Select one file to begin'}
            </span>
          </Label>
          <Input
            accept={MODEL_UPLOAD_ACCEPT}
            className="sr-only"
            id="quote-model"
            name="file"
            onChange={(event) => {
              const files = event.target.files ?? []
              const unsupported = getUnsupportedModelFilenames(files)
              if (unsupported.length > 0) {
                setFileError(getUnsupportedModelFilesMessage(unsupported))
                setFilename('')
                event.target.value = ''
                return
              }

              setFileError(null)
              setFilename(files[0]?.name ?? '')
            }}
            required
            type="file"
          />
          {fileError ? <p className="mt-3 text-sm text-red-500">{fileError}</p> : null}
        </div>

        <div className="p-6 md:p-10">
          <div className="flex items-start gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full border text-sm">
              2
            </span>
            <div>
              <h2 className="font-medium">Your details</h2>
              <p className="mt-1 text-sm text-primary/60">
                We&apos;ll email a link to your draft so you can return anytime.
              </p>
            </div>
          </div>

          {typeof user === 'undefined' ? (
            <p className="mt-8 text-sm text-primary/60">Checking your account...</p>
          ) : user ? (
            <div className="mt-8 flex items-center gap-3 rounded-md border bg-background p-4">
              <UserIcon className="size-5 text-primary/55" />
              <div className="min-w-0">
                <p className="text-sm text-primary/55">Continuing as</p>
                <p className="truncate font-medium">{user.email}</p>
              </div>
            </div>
          ) : (
            <div className="mt-8 space-y-3">
              <Label htmlFor="customerEmail">Email address</Label>
              <Input
                autoComplete="email"
                id="customerEmail"
                name="customerEmail"
                placeholder="name@example.com"
                required
                type="email"
              />
              <p className="text-xs text-primary/55">
                Prefer an account?{' '}
                <Link className="underline" href="/login">
                  Log in
                </Link>{' '}
                or{' '}
                <Link className="underline" href="/create-account">
                  create one
                </Link>
                .
              </p>
            </div>
          )}

          {state.error ? <p className="mt-5 text-sm text-red-500">{state.error}</p> : null}

          <Button
            className="mt-8 w-full"
            disabled={pending || typeof user === 'undefined' || !filename || Boolean(fileError)}
            size="lg"
            type="submit"
          >
            {pending ? 'Creating your draft...' : 'Upload and continue'}
          </Button>
          <p className="mt-3 text-center text-xs text-primary/50">
            We&apos;ll create a draft and email you a link so you can return anytime.
          </p>
        </div>
      </form>
    </section>
  )
}
