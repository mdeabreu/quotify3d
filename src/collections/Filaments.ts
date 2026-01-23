import type { CollectionConfig } from 'payload'

import { amountField } from '@payloadcms/plugin-ecommerce'

import { adminOnly } from '@/access/adminOnly'
import { currenciesConfig } from '@/config/currencies'

export const Filaments: CollectionConfig = {
  slug: 'filaments',
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: () => true,
    update: adminOnly,
  },
  admin: {
    defaultColumns: ['name', 'active', 'pricePerGram'],
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
        name: 'pricePerGram',
        label: 'Price per gram',
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
      relationTo: 'filament-configs',
      required: true,
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
          on: 'material',
          admin: {
            defaultColumns: ['name', 'active'],
          },
        },
      ],
    },
  ],
}
