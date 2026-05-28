import type { CollectionConfig, Field } from 'payload'

import { adminOnly } from '@/access/adminOnly'
import { currenciesConfig } from '@/config/currencies'
import { amountField } from '@payloadcms/plugin-ecommerce'

const fixedDiscountFields: Field[] = currenciesConfig.supportedCurrencies.map((currency) =>
  amountField({
    currenciesConfig,
    currency,
    overrides: {
      name: `discountAmountIn${currency.code.toUpperCase()}`,
      admin: {
        condition: (_, siblingData) => siblingData?.discountType === 'fixed',
      },
      label: `${currency.code.toUpperCase()} discount amount`,
      min: 0,
    },
  }),
)

export const Coupons: CollectionConfig = {
  slug: 'coupons',
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: adminOnly,
    update: adminOnly,
  },
  admin: {
    defaultColumns: ['title', 'code', 'enabled', 'discountType', 'appliesTo'],
    group: 'Ecommerce',
    useAsTitle: 'code',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'code',
      type: 'text',
      hooks: {
        beforeValidate: [
          ({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value),
        ],
      },
      index: true,
      required: true,
      unique: true,
    },
    {
      name: 'enabled',
      type: 'checkbox',
      admin: {
        position: 'sidebar',
      },
      defaultValue: true,
    },
    {
      name: 'appliesTo',
      type: 'select',
      defaultValue: 'cart',
      options: [
        { label: 'Cart', value: 'cart' },
        { label: 'Products', value: 'products' },
      ],
      required: true,
    },
    {
      name: 'eligibleProducts',
      type: 'relationship',
      admin: {
        condition: (_, siblingData) => siblingData?.appliesTo === 'products',
      },
      hasMany: true,
      label: 'Eligible products',
      relationTo: 'products',
    },
    {
      name: 'eligibleCustomers',
      type: 'relationship',
      admin: {
        description: 'Leave empty to allow both guests and logged-in customers.',
      },
      hasMany: true,
      label: 'Eligible customers',
      relationTo: 'users',
    },
    {
      type: 'row',
      fields: [
        {
          name: 'discountType',
          type: 'select',
          defaultValue: 'percentage',
          options: [
            { label: 'Percentage', value: 'percentage' },
            { label: 'Fixed amount', value: 'fixed' },
          ],
          required: true,
        },
        {
          name: 'percentOff',
          type: 'number',
          admin: {
            condition: (_, siblingData) => siblingData?.discountType === 'percentage',
          },
          label: 'Percent off',
          max: 100,
          min: 1,
          validate: (
            value: null | number | undefined,
            { siblingData }: { siblingData?: Record<string, unknown> },
          ) => {
            if (siblingData?.discountType !== 'percentage') return true
            return typeof value === 'number' && value >= 1 && value <= 100
              ? true
              : 'Enter a percentage between 1 and 100.'
          },
        },
      ],
    },
    ...fixedDiscountFields,
    {
      type: 'row',
      fields: [
        amountField({
          currenciesConfig,
          overrides: {
            name: 'minimumSubtotal',
            admin: {
              description: 'Smallest cart subtotal required before this coupon applies.',
            },
            label: 'Minimum subtotal',
            min: 0,
          },
        }),
        {
          name: 'maxRedemptions',
          type: 'number',
          min: 1,
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'startsAt',
          type: 'date',
          admin: {
            date: { pickerAppearance: 'dayAndTime' },
          },
        },
        {
          name: 'endsAt',
          type: 'date',
          admin: {
            date: { pickerAppearance: 'dayAndTime' },
          },
        },
      ],
    },
  ],
  timestamps: true,
}
