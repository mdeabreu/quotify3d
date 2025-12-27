import type { CollectionConfig } from 'payload'

export const Machines: CollectionConfig = {
  slug: 'machines',
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
