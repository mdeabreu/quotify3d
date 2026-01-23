import type { CollectionConfig } from 'payload'

import { amountField, currencyField } from '@payloadcms/plugin-ecommerce'

import { adminOrCustomerOwner } from '@/access/adminOrCustomerOwner'
import { publicAccess } from '@/access/publicAccess'
import { quoteItemsField } from '@/collections/Quotes/fields/quoteItemsField'
import { applyDefaultMachine } from '@/collections/Quotes/hooks/applyDefaultMachine'
import { resolveQuoteGcodes } from '@/collections/Quotes/hooks/resolveQuoteGcodes'
import { resolveQuoteSubtotal } from '@/collections/Quotes/hooks/resolveQuoteSubtotal'
import { currenciesConfig } from '@/config/currencies'
import { normalizeCustomerOrEmail } from '@/hooks/normalizeCustomerOrEmail'

export const Quotes: CollectionConfig = {
  slug: 'quotes',
  labels: {
    plural: 'Quotes',
    singular: 'Quote',
  },
  access: {
    create: publicAccess,
    delete: adminOrCustomerOwner,
    read: adminOrCustomerOwner,
    update: adminOrCustomerOwner,
  },
  admin: {
    defaultColumns: ['id', 'status', 'subtotal', 'customer', 'customerEmail'],
    group: 'Jobs',
  },
  fields: [
    {
      name: 'customer',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'customerEmail',
      type: 'email',
      admin: {
        description: 'Used when the requester is not logged in.',
        position: 'sidebar',
      },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'new',
      interfaceName: 'QuoteStatus',
      options: [
        { label: 'New', value: 'new' },
        { label: 'Reviewing', value: 'reviewing' },
        { label: 'Quoted', value: 'quoted' },
        { label: 'Approved', value: 'approved' },
        { label: 'Rejected', value: 'rejected' },
      ],
      required: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      type: 'row',
      admin: {
        position: 'sidebar',
      },
      fields: [
        amountField({
          currenciesConfig: currenciesConfig,
          overrides: {
            name: 'subtotal',
            label: 'Subtotal',
          },
        }),
        currencyField({
          currenciesConfig: currenciesConfig,
        }),
      ],
    },
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Request details',
          fields: [
            quoteItemsField(),
            {
              name: 'notes',
              type: 'textarea',
              admin: {
                description:
                  'Optional requirements, deadlines, or context provided by the requester.',
              },
            },
          ],
        },
      ],
    },
  ],
  hooks: {
    beforeValidate: [applyDefaultMachine],
    beforeChange: [normalizeCustomerOrEmail, resolveQuoteGcodes, resolveQuoteSubtotal],
  },
}
