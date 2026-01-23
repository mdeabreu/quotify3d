import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'

export const Vendors: CollectionConfig = {
  slug: 'vendors',
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: () => true,
    update: adminOnly,
  },
  admin: {
    defaultColumns: ['name', 'url'],
    group: 'Operations',
    useAsTitle: 'name',
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'name',
          type: 'text',
          required: true,
        },
        {
          name: 'url',
          type: 'text',
          required: true,
          admin: {
            description: 'Public storefront or vendor URL',
          },
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Spools',
      admin: {
        initCollapsed: true,
      },
      fields: [
        {
          name: 'spools',
          type: 'join',
          collection: 'spools',
          on: 'vendor',
          admin: {
            defaultColumns: ['name', 'active'],
          },
        },
      ],
    },
  ],
}
