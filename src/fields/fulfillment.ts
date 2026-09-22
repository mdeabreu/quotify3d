import type { Field } from 'payload'

type FulfillmentFieldsOptions = {
  includeLegacyShipping?: boolean
  readOnly?: boolean
}

export const fulfillmentFields = ({
  includeLegacyShipping = false,
  readOnly = false,
}: FulfillmentFieldsOptions = {}): Field[] => [
  {
    name: 'fulfillmentMethod',
    type: 'select',
    ...(readOnly ? { access: { update: () => false } } : {}),
    admin: {
      description: includeLegacyShipping
        ? 'Shipping is retained for orders created before pickup-only checkout.'
        : 'Only local pickup is currently available.',
      position: 'sidebar',
      readOnly,
    },
    defaultValue: 'pickup',
    label: 'Fulfillment method',
    options: [
      { label: 'Pickup', value: 'pickup' },
      ...(includeLegacyShipping ? [{ label: 'Shipping', value: 'shipping' }] : []),
    ],
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
