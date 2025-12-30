import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'

export const Filaments: CollectionConfig = {
  slug: 'filaments',
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: () => true,
    update: adminOnly,
  },
  admin: {
    defaultColumns: ['name', 'material', 'vendor', 'colour'],
    group: 'Operations',
    useAsTitle: 'name',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
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
    {
      type: 'row',
      fields: [
        {
          name: 'material',
          type: 'relationship',
          relationTo: 'materials',
          required: true,
        },
        {
          name: 'colour',
          type: 'relationship',
          relationTo: 'colours',
          required: true,
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'vendor',
          type: 'relationship',
          relationTo: 'vendors',
          required: true,
        },
        {
          name: 'config',
          type: 'relationship',
          relationTo: 'filament-configs',
          required: true,
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Purchasing history',
      admin: {
        initCollapsed: true,
      },
      fields: [
        {
          name: 'purchases',
          type: 'array',
          labels: {
            plural: 'Purchases',
            singular: 'Purchase',
          },
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'date',
                  type: 'date',
                  required: true,
                },
                {
                  name: 'pricePerUnit',
                  type: 'number',
                  min: 0,
                  required: true,
                },
                {
                  name: 'unitsPurchased',
                  type: 'number',
                  min: 1,
                  required: true,
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'url',
                  type: 'text',
                  required: true,
                  validate: (value: unknown) => {
                    if (typeof value !== 'string' || !value) return 'URL is required'
                    try {
                      new URL(value)
                      return true
                    } catch {
                      return 'Enter a valid purchase URL'
                    }
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}
