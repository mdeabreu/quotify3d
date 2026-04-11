import type { GlobalConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'
import { link } from '@/fields/link'
import { revalidateGlobal } from '@/globals/hooks/revalidateGlobal'

export const Header: GlobalConfig = {
  slug: 'header',
  access: {
    read: () => true,
    update: adminOnly,
  },
  hooks: {
    afterChange: [revalidateGlobal('header')],
  },
  fields: [
    {
      name: 'navItems',
      type: 'array',
      fields: [
        link({
          appearances: false,
        }),
      ],
      maxRows: 6,
    },
  ],
}
