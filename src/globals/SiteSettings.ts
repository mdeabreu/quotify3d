import type { GlobalConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'
import { revalidateGlobal } from '@/globals/hooks/revalidateGlobal'

export const SiteSettings: GlobalConfig = {
  slug: 'siteSettings',
  access: {
    read: () => true,
    update: adminOnly,
  },
  admin: {
    group: 'Settings',
  },
  hooks: {
    afterChange: [revalidateGlobal('siteSettings')],
  },
  fields: [
    {
      name: 'siteName',
      type: 'text',
      admin: {
        description: 'Used for public logo text, accessibility labels, and default metadata.',
      },
    },
    {
      name: 'companyName',
      type: 'text',
      admin: {
        description: 'Used for copyright text. Falls back to the site name when empty.',
      },
    },
    {
      name: 'logo',
      type: 'upload',
      filterOptions: {
        mimeType: { contains: 'image' },
      },
      relationTo: 'media',
    },
  ],
}
