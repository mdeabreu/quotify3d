import type { Field } from 'payload'

export const quoteItemsField = (): Field => ({
  name: 'items',
  type: 'array',
  required: true,
  minRows: 1,
  labels: {
    plural: 'Items',
    singular: 'Item',
  },
  admin: {
    initCollapsed: true,
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'model',
          type: 'relationship',
          relationTo: 'models',
          required: true,
          admin: {
            width: '60%',
          },
          filterOptions: ({ data }) => {
            if (data.customer) {
              return {
                customer: {
                  equals: data.customer,
                },
              }
            }

            return true
          },
        },
        {
          name: 'quantity',
          type: 'number',
          min: 1,
          required: true,
          defaultValue: 1,
          admin: {
            width: '40%',
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'filament',
          label: 'Material',
          type: 'relationship',
          relationTo: 'filaments',
          required: true,
          admin: {
            width: '34%',
          },
        },
        {
          name: 'colour',
          type: 'relationship',
          relationTo: 'colours',
          required: true,
          admin: {
            width: '33%',
          },
        },
        {
          name: 'process',
          type: 'relationship',
          relationTo: 'processes',
          required: true,
          admin: {
            width: '33%',
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'machine',
          type: 'relationship',
          relationTo: 'machines',
          admin: {
            width: '50%',
          },
        },
        {
          name: 'gcode',
          type: 'relationship',
          relationTo: 'gcodes',
          admin: {
            readOnly: true,
            width: '50%',
          },
        },
      ],
    },
  ],
})
