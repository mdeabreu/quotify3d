import { cn } from '@/utilities/cn'
import React from 'react'
import { RichText } from '@/components/RichText'
import type { DefaultDocumentIDType } from 'payload'
import type { ContentBlock as ContentBlockProps } from '@/payload-types'

import { CMSLink } from '../../components/Link'

export const ContentBlock: React.FC<
  ContentBlockProps & {
    id?: DefaultDocumentIDType
    className?: string
  }
> = (props) => {
  const { columns } = props

  const colsSpanClasses = {
    full: 'md:col-span-12',
    half: 'md:col-span-6',
    oneThird: 'md:col-span-4',
    twoThirds: 'md:col-span-8',
  }

  return (
    <div className="container my-16">
      <div className="grid grid-cols-12 gap-6">
        {columns &&
          columns.length > 0 &&
          columns.map((col, index) => {
            const { enableLink, link, richText, size } = col

            return (
              <div
                className={cn(`col-span-12 ${colsSpanClasses[size!]}`, {
                  'rounded-2xl border border-border bg-card/70 p-6 md:p-8': size !== 'full',
                  'max-w-4xl': size === 'full',
                })}
                key={index}
              >
                {richText && <RichText data={richText} enableGutter={false} />}

                {enableLink && <CMSLink {...link} />}
              </div>
            )
          })}
      </div>
    </div>
  )
}
