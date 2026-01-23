import type { CollectionConfig } from 'payload'

import { amountField } from '@payloadcms/plugin-ecommerce'

import { adminOnly } from '@/access/adminOnly'
import { currenciesConfig } from '@/config/currencies'

export const Machines: CollectionConfig = {
  slug: 'machines',
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: () => true,
    update: adminOnly,
  },
  orderable: true,
  admin: {
    defaultColumns: ['name', 'active', 'pricePerHour'],
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
      admin: {
        position: 'sidebar',
      },
    },
    amountField({
      currenciesConfig,
      overrides: {
        name: 'pricePerHour',
        label: 'Price per hour',
        required: true,
        min: 0,
        admin: {
          position: 'sidebar',
        },
      },
    }),
    {
      name: 'config',
      type: 'relationship',
      relationTo: 'machine-configs',
      required: true,
    },
  ],
}
