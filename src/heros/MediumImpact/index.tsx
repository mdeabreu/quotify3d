import React from 'react'

import type { Page } from '@/payload-types'

import { CMSLink } from '@/components/Link'
import { Media } from '@/components/Media'
import { RichText } from '@/components/RichText'

export const MediumImpactHero: React.FC<Page['hero']> = ({ links, media, richText }) => {
  return (
    <div>
      <div className="container mb-8">
        {richText && (
          <RichText
            className="mb-6 max-w-4xl [&_h1]:break-words [&_h1]:text-[clamp(2.65rem,8vw,3.8rem)] [&_h1]:leading-[1.08] [&_p]:max-w-3xl [&_p]:text-lg"
            data={richText}
            enableGutter={false}
          />
        )}

        {Array.isArray(links) && links.length > 0 && (
          <ul className="flex flex-wrap gap-4">
            {links.map(({ link }, i) => {
              return (
                <li key={i}>
                  <CMSLink {...link} />
                </li>
              )
            })}
          </ul>
        )}
      </div>
      <div className="container">
        {media && typeof media === 'object' && (
          <div>
            <Media
              className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm"
              imgClassName="h-auto w-full"
              priority
              resource={media}
            />
            {media?.caption && (
              <div className="mt-3">
                <RichText data={media.caption} enableGutter={false} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
