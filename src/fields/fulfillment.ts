import type { Field } from 'payload'

type FulfillmentFieldsOptions = {
  readOnly?: boolean
}

export const fulfillmentFields = ({ readOnly = false }: FulfillmentFieldsOptions = {}): Field[] => [
  {
    name: 'fulfillmentMethod',
    type: 'select',
    ...(readOnly ? { access: { update: () => false } } : {}),
    admin: {
      description: 'Only local pickup is currently available.',
      position: 'sidebar',
      readOnly,
    },
    defaultValue: 'pickup',
    label: 'Fulfillment method',
    options: [{ label: 'Pickup', value: 'pickup' }],
    required: true,
  },
  {
    name: 'pickupContact',
    type: 'group',
    ...(readOnly ? { access: { update: () => false } } : {}),
    admin: {
      description: 'The person who will collect this order.',
      readOnly,
    },
    fields: [
      { name: 'firstName', type: 'text', label: 'First name' },
      { name: 'lastName', type: 'text', label: 'Last name' },
      { name: 'phone', type: 'text', label: 'Phone' },
    ],
    label: 'Pickup contact',
  },
]
