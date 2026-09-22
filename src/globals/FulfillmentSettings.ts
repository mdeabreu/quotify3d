import type { GlobalConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'
import { revalidateGlobal } from '@/globals/hooks/revalidateGlobal'

export const FulfillmentSettings: GlobalConfig = {
  slug: 'fulfillmentSettings',
  access: {
    read: adminOnly,
    update: adminOnly,
  },
  admin: {
    group: 'Settings',
  },
  hooks: {
    afterChange: [revalidateGlobal('fulfillmentSettings')],
  },
  fields: [
    {
      name: 'pickupEnabled',
      type: 'checkbox',
      defaultValue: true,
      label: 'Enable pickup checkout',
    },
    {
      name: 'pickupLabel',
      type: 'text',
      defaultValue: 'Local pickup',
      label: 'Pickup label',
      required: true,
    },
    {
      name: 'pickupCheckoutDescription',
      type: 'textarea',
      defaultValue: 'Pickup details will be sent to you when your order is ready for collection.',
      label: 'Checkout description',
      required: true,
    },
    {
      name: 'pickupReadyInstructions',
      type: 'textarea',
      admin: {
        description:
          'Exact address, hours, access details, or collection instructions. These are only revealed after an order is marked ready.',
      },
      label: 'Ready-for-pickup instructions',
    },
  ],
}
