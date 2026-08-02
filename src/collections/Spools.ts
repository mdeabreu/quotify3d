import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'
import { generateSpoolName } from '@/collections/Spools/hooks/generateSpoolName'
import { revalidateLibraryDelete, revalidateLibraryPage } from '@/hooks/revalidateLibrary'

const libraryPaths = ['/materials', '/colours']

export const Spools: CollectionConfig = {
  slug: 'spools',
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: () => true,
    update: adminOnly,
  },
  admin: {
    defaultColumns: ['name', 'active', 'vendor', 'colour', 'material'],
    group: 'Operations',
    useAsTitle: 'name',
  },
  fields: [
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
          name: 'name',
          type: 'text',
          admin: {
            description: 'Leave blank to generate a name from the vendor, colour, and material.',
          },
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
          name: 'colour',
          type: 'relationship',
          relationTo: 'colours',
          required: true,
        },
        {
          name: 'material',
          type: 'relationship',
          relationTo: 'filaments',
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
  hooks: {
    beforeValidate: [generateSpoolName],
    afterChange: [revalidateLibraryPage(libraryPaths)],
    afterDelete: [revalidateLibraryDelete(libraryPaths)],
  },
}
