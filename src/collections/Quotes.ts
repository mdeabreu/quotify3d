import type { CollectionConfig } from 'payload'

import { amountField, currencyField } from '@payloadcms/plugin-ecommerce'

import { adminOrCustomerOwner } from '@/access/adminOrCustomerOwner'
import { publicAccess } from '@/access/publicAccess'
import { quoteItemsField } from '@/collections/Quotes/fields/quoteItemsField'
import { ecommerceCurrenciesConfig } from '@/config/currencies'
import { applyDefaultMachine } from '@/collections/Quotes/hooks/applyDefaultMachine'
import { createQuoteGcodes } from '@/collections/Quotes/hooks/createQuoteGcodes'
import { normalizeQuoteCustomer } from '@/collections/Quotes/hooks/normalizeQuoteCustomer'
import { resolveQuoteItemsAndAmount } from '@/collections/Quotes/hooks/resolveQuoteItemsAndAmount'

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
    defaultColumns: ['status', 'amount', 'customerEmail'],
    group: 'Jobs',
    useAsTitle: 'id',
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
          currenciesConfig: ecommerceCurrenciesConfig,
          overrides: {
            required: false,
          },
        }),
        currencyField({
          currenciesConfig: ecommerceCurrenciesConfig,
          overrides: {
            required: false,
          },
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
                description: 'Optional requirements, deadlines, or context provided by the requester.',
              },
            },
          ],
        },
        {
          label: 'Gcodes',
          fields: [
            {
              name: 'gcodes',
              type: 'join',
              collection: 'gcodes',
              on: 'quote',
              admin: {
                allowCreate: false,
                defaultColumns: ['status', 'model', 'material', 'process', 'filament', 'machine'],
              },
            },
          ],
        },
      ],
    },
  ],
  hooks: {
    beforeValidate: [applyDefaultMachine],
    beforeChange: [normalizeQuoteCustomer, resolveQuoteItemsAndAmount],
    afterChange: [createQuoteGcodes],
  },
}
