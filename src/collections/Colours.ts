import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'

export const Colours: CollectionConfig = {
  slug: 'colours',
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: () => true,
    update: adminOnly,
  },
  admin: {
    defaultColumns: ['name', 'finish', 'type'],
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
    {
      name: 'finish',
      type: 'select',
      defaultValue: 'regular',
      options: [
        { label: 'Regular', value: 'regular' },
        { label: 'Matte', value: 'matte' },
        { label: 'Silk', value: 'silk' },
      ],
      required: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'type',
      type: 'select',
      defaultValue: 'solid',
      options: [
        { label: 'Solid', value: 'solid' },
        { label: 'Co-extrusion', value: 'co-extrusion' },
        { label: 'Gradient', value: 'gradient' },
      ],
      required: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      type: 'collapsible',
      label: 'Swatches',
      admin: {
        initCollapsed: true,
      },
      fields: [
        {
          name: 'swatches',
          type: 'array',
          labels: {
            plural: 'Swatches',
            singular: 'Swatch',
          },
          minRows: 1,
          fields: [
            {
              name: 'hexcode',
              type: 'text',
              required: true,
              admin: {
                description: 'Hex value including #, e.g. #FFAA00',
              },
              validate: (value: unknown) => {
                if (typeof value !== 'string') return 'Provide a valid hex code'
                return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(value)
                  ? true
                  : 'Use a valid hex code including #'
              },
            },
          ],
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
          on: 'colour',
          admin: {
            defaultColumns: ['name', 'active'],
          },
        },
      ],
    },
  ],
}
