import type { CollectionConfig, FieldAccess } from 'payload'

import { amountField, currencyField } from '@payloadcms/plugin-ecommerce'

import { adminOnlyFieldAccess } from '@/access/adminOnlyFieldAccess'
import { adminOrCustomerOwner } from '@/access/adminOrCustomerOwner'
import { publicAccess } from '@/access/publicAccess'
import { checkRole } from '@/access/utilities'
import { quoteItemsField } from '@/collections/Quotes/fields/quoteItemsField'
import { applyDefaultMachine } from '@/collections/Quotes/hooks/applyDefaultMachine'
import { createProductsOnApproval } from '@/collections/Quotes/hooks/createProductsOnApproval'
import { ensurePricedItemsBeforeApproval } from '@/collections/Quotes/hooks/ensurePricedItemsBeforeApproval'
import { normalizeQuoteItemSpools } from '@/collections/Quotes/hooks/normalizeQuoteItemSpools'
import { resetStatusWhenSlicedQuoteChanges } from '@/collections/Quotes/hooks/resetStatusWhenSlicedQuoteChanges'
import { sendQuoteApprovedEmail } from '@/collections/Quotes/hooks/sendQuoteApprovedEmail'
import { sendQuoteCreatedEmail } from '@/collections/Quotes/hooks/sendQuoteCreatedEmail'
import { sendQuoteReadyForReviewAdminEmail } from '@/collections/Quotes/hooks/sendQuoteReadyForReviewAdminEmail'
import { syncOwnedGcodesForQuote } from '@/collections/Quotes/hooks/syncOwnedGcodesForQuote'
import { currenciesConfig } from '@/config/currencies'
import { normalizeCustomerOrEmail } from '@/hooks/normalizeCustomerOrEmail'

export const adminNotesReadAccess: FieldAccess = ({ doc, req: { user } }) => {
  if (checkRole(['admin'], user)) return true

  return doc?.status === 'approved'
}

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
      name: 'accessToken',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
      hooks: {
        beforeValidate: [
          ({ operation, value }) => {
            if (operation === 'create' || !value) {
              return crypto.randomUUID()
            }

            return value
          },
        ],
      },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'new',
      interfaceName: 'QuoteStatus',
      options: [
        { label: 'New', value: 'new' },
        { label: 'Queued', value: 'queued' },
        { label: 'Sliced', value: 'sliced' },
        { label: 'Ready for Review', value: 'ready-for-review' },
        { label: 'In Review', value: 'in-review' },
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
        {
          label: 'Admin response',
          fields: [
            {
              name: 'adminNotes',
              type: 'textarea',
              access: {
                create: adminOnlyFieldAccess,
                read: adminNotesReadAccess,
                update: adminOnlyFieldAccess,
              },
              admin: {
                description:
                  'Optional customer-facing notes shown on approved quotes, such as pricing changes or printability context.',
              },
            },
          ],
        },
      ],
    },
  ],
  hooks: {
    beforeValidate: [normalizeQuoteItemSpools, applyDefaultMachine],
    beforeChange: [
      normalizeCustomerOrEmail,
      resetStatusWhenSlicedQuoteChanges,
      ensurePricedItemsBeforeApproval,
    ],
    afterChange: [
      syncOwnedGcodesForQuote,
      createProductsOnApproval,
      sendQuoteCreatedEmail,
      sendQuoteApprovedEmail,
      sendQuoteReadyForReviewAdminEmail,
    ],
  },
}
