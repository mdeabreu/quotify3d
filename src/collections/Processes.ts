import type { CollectionConfig } from 'payload'

export const Processes: CollectionConfig = {
  slug: 'processes',
  admin: {
    useAsTitle: 'name',
    group: '3D Printer Configuration',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
  ],
}
