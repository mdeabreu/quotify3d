import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'

export const Materials: CollectionConfig = {
  slug: 'materials',
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: () => true,
    update: adminOnly,
  },
  admin: {
    defaultColumns: ['name', 'pricePerGram'],
    group: 'Catalog',
    useAsTitle: 'name',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'pricePerGram',
      type: 'number',
      required: true,
      min: 0,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'config',
      type: 'relationship',
      relationTo: 'filament-configs',
      required: true,
    },
    {
      type: 'collapsible',
      label: 'Filaments',
      admin: {
        initCollapsed: true,
      },
      fields: [
        {
          name: 'filaments',
          type: 'join',
          collection: 'filaments',
          on: 'material',
          admin: {
            defaultColumns: ['name', 'active'],
          },
        },
      ],
    },
  ],
}
