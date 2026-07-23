'use client'

import { Trash2Icon } from 'lucide-react'
import type { ReactNode } from 'react'

import { ModelPreviewer } from '@/components/ModelPreviewer'
import { Button } from '@/components/ui/button'
import { cn } from '@/utilities/cn'

import { getQuoteItemState } from './QuoteItemList'
import type { QuoteWorkspaceItem } from './types'

const issueMessage = (item: QuoteWorkspaceItem) => {
  const issue = item.configurationIssues.find((candidate) =>
    candidate.code.startsWith('unavailable-'),
  )
  switch (issue?.code) {
    case 'unavailable-material':
      return 'The saved material is no longer available. Choose a replacement to continue.'
    case 'unavailable-process':
      return 'The saved print profile is no longer available. Choose a replacement to continue.'
    case 'unavailable-machine':
      return 'No active machine is available for this saved setup.'
    case 'unavailable-slot-colour':
      return `Colour group ${(issue.slotIndex ?? 0) + 1} uses a colour that is unavailable for this material.`
    default:
      return null
  }
}

export const QuoteItemEditor = ({
  accessToken,
  children,
  colors,
  editable,
  email,
  fallbackSrc,
  item,
  itemCount,
  quoteID,
  removeItemAction,
}: {
  accessToken: string
  children: ReactNode
  colors: string[]
  editable: boolean
  email: string
  fallbackSrc: string
  item: QuoteWorkspaceItem
  itemCount: number
  quoteID: number
  removeItemAction: (formData: FormData) => void | Promise<void>
}) => {
  const state = getQuoteItemState(item)
  const warning = issueMessage(item)
  return (
    <main className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 className="text-xl font-medium break-all">{item.modelLabel}</h2>
          <p className={cn('mt-1 text-sm', state.tone)}>{state.label}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-sm border px-2 py-1 text-xs text-primary/60">
            {item.modelSlotCount} colour group{item.modelSlotCount === 1 ? '' : 's'}
          </span>
          {editable && itemCount > 1 ? (
            <form action={removeItemAction}>
              <input name="quoteID" type="hidden" value={quoteID} />
              <input name="itemID" type="hidden" value={item.id} />
              {email ? <input name="email" type="hidden" value={email} /> : null}
              {accessToken ? <input name="accessToken" type="hidden" value={accessToken} /> : null}
              <Button size="icon" title="Remove model" type="submit" variant="outline">
                <Trash2Icon className="size-4" />
                <span className="sr-only">Remove model</span>
              </Button>
            </form>
          ) : null}
        </div>
      </div>

      <div className="h-72 overflow-hidden border-b md:h-80 xl:h-96">
        <ModelPreviewer
          colors={colors}
          fallbackSrc={fallbackSrc}
          key={item.id}
          model={{ name: item.modelLabel, size: item.modelSize, url: item.modelURL }}
        />
      </div>

      {warning ? (
        <div className="border-b bg-amber-50 px-5 py-3 text-sm text-amber-900">{warning}</div>
      ) : null}
      {children}
    </main>
  )
}
