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
      defaultValue: 'Quotify3D',
      admin: {
        description: 'Used for public logo text, accessibility labels, and default metadata.',
      },
    },
    {
      name: 'companyName',
      type: 'text',
      defaultValue: 'Quotify3D',
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
    {
      name: 'defaultOpenGraph',
      type: 'group',
      admin: {
        description: 'Used when a page or product does not provide its own share metadata.',
      },
      fields: [
        {
          name: 'title',
          type: 'text',
          defaultValue: 'Quotify3D',
        },
        {
          name: 'description',
          type: 'textarea',
          defaultValue:
            'Upload a 3D model, compare material and finish options, and request a print quote online.',
        },
        {
          name: 'image',
          type: 'upload',
          filterOptions: {
            mimeType: { contains: 'image' },
          },
          relationTo: 'media',
        },
      ],
    },
    {
      name: 'quoteProductPlaceholder',
      type: 'upload',
      admin: {
        description: 'Shown for quote-created products that do not have a gallery image.',
      },
      filterOptions: {
        mimeType: { contains: 'image' },
      },
      relationTo: 'media',
    },
  ],
}
