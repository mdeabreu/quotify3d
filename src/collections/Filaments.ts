import type { CollectionConfig } from 'payload'

export const Filaments: CollectionConfig = {
  slug: 'filaments',
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
