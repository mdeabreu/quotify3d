import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'

export const Proccesses: CollectionConfig = {
  slug: 'processes',
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: () => true,
    update: adminOnly,
  },
  admin: {
    defaultColumns: ['name', 'active'],
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
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      required: true,
    },
    {
      name: 'config',
      type: 'relationship',
      relationTo: 'process-configs',
      required: true,
    },
  ],
}
