'use client'

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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

import type { QuoteWorkspaceItem } from './types'

export const SubmissionDialog = ({
  accessToken,
  canSubmit,
  currencyCode,
  email,
  items,
  quoteID,
  quoteNotes,
  submitForReviewAction,
}: {
  accessToken: string
  canSubmit: boolean
  currencyCode?: string
  email: string
  items: QuoteWorkspaceItem[]
  quoteID: number
  quoteNotes?: string | null
  submitForReviewAction: (formData: FormData) => void | Promise<void>
}) => (
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
          <div className="flex items-center justify-between gap-4 px-4 py-3" key={item.id}>
            <div className="min-w-0">
              <p className="truncate font-medium">{item.modelLabel}</p>
              <p className="text-sm text-primary/55">
                {item.filamentLabel} · {item.processLabel} · Qty {item.quantity}
              </p>
            </div>
            {item.gcodeStatus === 'failed' ? (
              <span className="text-sm text-red-600">Manual review</span>
            ) : (
              <Price amount={(item.gcodePrice ?? 0) * item.quantity} currencyCode={currencyCode} />
            )}
          </div>
        ))}
      </div>
      <form action={submitForReviewAction}>
        <input name="quoteID" type="hidden" value={quoteID} />
        {email ? <input name="email" type="hidden" value={email} /> : null}
        {accessToken ? <input name="accessToken" type="hidden" value={accessToken} /> : null}
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
)
