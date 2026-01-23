import type { CollectionConfig } from 'payload'

import { amountField } from '@payloadcms/plugin-ecommerce'

import { adminOnly } from '@/access/adminOnly'
import { gcodeStatusOptions } from '@/collections/constants/gcodeStatusOptions'
import { ensureUniqueCombination } from '@/collections/Gcodes/hooks/ensureUniqueCombination'
import { queueSliceWorkflow } from '@/collections/Gcodes/hooks/queueSliceWorkflow'
import { currenciesConfig } from '@/config/currencies'

const slicerFieldAccess = {
  create: () => false,
  update: () => false,
}

export const Gcodes: CollectionConfig = {
  slug: 'gcodes',
  labels: {
    plural: 'Gcodes',
    singular: 'Gcode',
  },
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: adminOnly,
    update: adminOnly,
  },
  admin: {
    group: 'Jobs',
    defaultColumns: ['id', 'status', 'model', 'filament', 'process', 'machine'],
  },
  fields: [
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'queued',
      options: gcodeStatusOptions,
      admin: {
        position: 'sidebar',
      },
    },
    amountField({
      currenciesConfig,
      overrides: {
        name: 'estimatedPrice',
        label: 'Estimated price',
        access: slicerFieldAccess,
        admin: {
          position: 'sidebar',
          description: 'Estimated price based on slicer output.',
        },
      },
    }),
    {
      type: 'row',
      fields: [
        {
          name: 'model',
          type: 'relationship',
          relationTo: 'models',
          required: true,
          access: {
            update: () => false,
          },
          admin: {
            width: '100%',
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'filament',
          type: 'relationship',
          relationTo: 'filaments',
          required: true,
          access: {
            update: () => false,
          },
          admin: {},
        },
        {
          name: 'process',
          type: 'relationship',
          relationTo: 'processes',
          required: true,
          access: {
            update: () => false,
          },
          admin: {},
        },
        {
          name: 'machine',
          type: 'relationship',
          relationTo: 'machines',
          required: true,
          access: {
            update: () => false,
          },
          admin: {},
        },
      ],
    },
    {
      name: 'weightOverride',
      type: 'number',
      min: 0,
      admin: {
        position: 'sidebar',
        description: 'Optional override for total weight (grams).',
      },
    },
    {
      name: 'durationOverride',
      type: 'number',
      min: 0,
      admin: {
        position: 'sidebar',
        description: 'Optional override for total duration (seconds).',
      },
    },
    amountField({
      currenciesConfig,
      overrides: {
        name: 'priceOverride',
        label: 'Price override',
        admin: {
          position: 'sidebar',
          description: 'Optional override for pricing calculations.',
        },
      },
    }),
    {
      type: 'collapsible',
      label: 'Slicer',
      admin: {
        initCollapsed: true,
      },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'estimatedWeight',
              type: 'number',
              min: 0,
              access: slicerFieldAccess,
              admin: {
                description: 'Total across plates (grams).',
                width: '50%',
              },
            },
            {
              name: 'estimatedDuration',
              type: 'number',
              min: 0,
              access: slicerFieldAccess,
              admin: {
                description: 'Total across plates (seconds).',
                width: '50%',
              },
            },
          ],
        },
        {
          name: 'slicingCommand',
          type: 'textarea',
          access: slicerFieldAccess,
          admin: {},
        },
        {
          name: 'slicerOutput',
          type: 'textarea',
          access: slicerFieldAccess,
          admin: {
            description: 'Stdout/stderr emitted by the slicer.',
          },
        },
        {
          name: 'error',
          label: 'Error details',
          type: 'textarea',
          access: slicerFieldAccess,
          admin: {
            description: 'Set when the slicing workflow fails.',
          },
        },
        {
          name: 'plates',
          label: 'Plates',
          type: 'array',
          access: slicerFieldAccess,
          admin: {
            initCollapsed: true,
          },
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'estimatedWeight',
                  type: 'number',
                  min: 0,
                  access: slicerFieldAccess,
                  admin: {
                    description: 'Per-plate filament estimate (grams).',
                    width: '50%',
                  },
                },
                {
                  name: 'estimatedDuration',
                  type: 'number',
                  min: 0,
                  access: slicerFieldAccess,
                  admin: {
                    description: 'Per-plate time estimate (seconds).',
                    width: '50%',
                  },
                },
              ],
            },
            {
              name: 'gcode',
              label: 'G-code',
              type: 'code',
              access: slicerFieldAccess,
              admin: {
                language: 'gcode',
              },
            },
          ],
        },
      ],
    },
  ],
  hooks: {
    beforeValidate: [ensureUniqueCombination],
    afterChange: [queueSliceWorkflow],
  },
}
