import type { CollectionConfig } from 'payload'

export const ProcessConfigs: CollectionConfig = {
  slug: 'process-configs',
  admin: {
    useAsTitle: 'name',
    group: 'Configuration',
    defaultColumns: ['name'],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      type: 'collapsible',
      label: 'Configuration',
      admin: {
        initCollapsed: true,
      },
      fields: [
        {
          name: 'config',
          type: 'json',
          required: true,
          defaultValue: {},
        },
      ],
    },
  ],
}
