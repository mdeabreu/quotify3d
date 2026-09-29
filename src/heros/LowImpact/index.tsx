import React from 'react'

import type { Page } from '@/payload-types'

import { RichText } from '@/components/RichText'

type LowImpactHeroType =
  | {
      children?: React.ReactNode
      richText?: never
    }
  | (Omit<Page['hero'], 'richText'> & {
      children?: never
      richText?: Page['hero']['richText']
    })

export const LowImpactHero: React.FC<LowImpactHeroType> = ({ children, richText }) => {
  return (
    <div className="container mt-16">
      <div className="max-w-3xl">
        {children ||
          (richText && (
            <RichText
              className="[&_h1]:text-[clamp(2.6rem,8vw,3.8rem)] [&_h1]:leading-[1.08] [&_p]:text-lg"
              data={richText}
              enableGutter={false}
            />
          ))}
      </div>
    </div>
  )
}
