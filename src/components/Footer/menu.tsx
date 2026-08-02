import type { Footer } from '@/payload-types'

import { CMSLink } from '@/components/Link'
import React from 'react'

interface Props {
  groups: Footer['navGroups']
}

export function FooterMenu({ groups }: Props) {
  if (!groups?.length) return null

  return (
    <nav aria-label="Footer" className="grid flex-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
      {groups.map((group) => (
        <div key={group.id ?? group.label}>
          <h2 className="mb-3 font-medium text-black dark:text-white">{group.label}</h2>
          <ul className="space-y-2">
            {(group.links ?? []).map((item) => (
              <li key={item.id}>
                <CMSLink appearance="link" {...item.link} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}
