import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'

export const Spools: CollectionConfig = {
  slug: 'spools',
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: () => true,
    update: adminOnly,
  },
  admin: {
    defaultColumns: ['name', 'material', 'colour', 'vendor'],
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
          name: 'vendor',
          type: 'relationship',
          relationTo: 'vendors',
          required: true,
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'material',
          type: 'relationship',
          relationTo: 'filaments',
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
                  admin: {
                    width: '33%',
                  },
                },
                {
                  name: 'pricePerUnit',
                  type: 'number',
                  min: 0,
                  required: true,
                  admin: {
                    width: '33%',
                  },
                },
                {
                  name: 'unitsPurchased',
                  type: 'number',
                  min: 1,
                  required: true,
                  admin: {
                    width: '33%',
                  },
                },
              ],
            },
            {
              name: 'url',
              type: 'text',
              required: true,
            },
          ],
        },
      ],
    },
  ],
}
