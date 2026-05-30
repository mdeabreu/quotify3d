import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'
import { currenciesConfig } from '@/config/currencies'
import { amountField } from '@payloadcms/plugin-ecommerce'

export const CouponRedemptions: CollectionConfig = {
  slug: 'coupon-redemptions',
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: adminOnly,
    update: adminOnly,
  },
  admin: {
    defaultColumns: ['couponCode', 'coupon', 'order', 'transaction', 'discountAmount', 'redeemedAt'],
    group: 'Ecommerce',
    useAsTitle: 'couponCode',
  },
  fields: [
    {
      name: 'coupon',
      type: 'relationship',
      index: true,
      relationTo: 'coupons',
      required: true,
    },
    {
      name: 'order',
      type: 'relationship',
      index: true,
      relationTo: 'orders',
      required: true,
    },
    {
      name: 'transaction',
      type: 'relationship',
      index: true,
      relationTo: 'transactions',
      required: true,
      unique: true,
    },
    {
      name: 'cart',
      type: 'relationship',
      index: true,
      relationTo: 'carts',
    },
    {
      name: 'customer',
      type: 'relationship',
      index: true,
      relationTo: 'users',
    },
    {
      name: 'customerEmail',
      type: 'email',
      index: true,
    },
    {
      name: 'couponCode',
      type: 'text',
      index: true,
      required: true,
    },
    amountField({
      currenciesConfig,
      overrides: {
        name: 'discountAmount',
        required: true,
      },
    }),
    {
      name: 'currency',
      type: 'select',
      defaultValue: currenciesConfig.defaultCurrency,
      options: currenciesConfig.supportedCurrencies.map((currency) => ({
        label: currency.code,
        value: currency.code,
      })),
      required: true,
    },
    {
      name: 'redeemedAt',
      type: 'date',
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
      },
      defaultValue: () => new Date().toISOString(),
      index: true,
      required: true,
    },
  ],
  timestamps: true,
}
