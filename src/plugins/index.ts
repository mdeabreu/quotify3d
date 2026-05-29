import { amountField, ecommercePlugin } from '@payloadcms/plugin-ecommerce'
import { formBuilderPlugin } from '@payloadcms/plugin-form-builder'
import { seoPlugin } from '@payloadcms/plugin-seo'
import { GenerateTitle, GenerateURL } from '@payloadcms/plugin-seo/types'
import { FixedToolbarFeature, HeadingFeature, lexicalEditor } from '@payloadcms/richtext-lexical'
import { CollectionBeforeValidateHook, Plugin } from 'payload'

import { adminOnlyFieldAccess } from '@/access/adminOnlyFieldAccess'
import { adminOrPublishedStatus } from '@/access/adminOrPublishedStatus'
import { customerOnlyFieldAccess } from '@/access/customerOnlyFieldAccess'
import { isAdmin } from '@/access/isAdmin'
import { isDocumentOwner } from '@/access/isDocumentOwner'
import { sendOrderCreatedAdminEmail } from '@/collections/Orders/hooks/sendOrderCreatedAdminEmail'
import { sendOrderCreatedEmail } from '@/collections/Orders/hooks/sendOrderCreatedEmail'
import { ProductsCollection } from '@/collections/Products'
import { currenciesConfig } from '@/config/currencies'
import { Page, Product, Transaction } from '@/payload-types'
import {
  applyCouponDiscount,
  applyCouponPreviewBeforeChange,
  resolveCouponCodeBeforeValidate,
} from '@/utilities/coupons'
import { getServerSideURL } from '@/utilities/getURL'
import { stripeAdapter } from '@payloadcms/plugin-ecommerce/payments/stripe'

const generateTitle: GenerateTitle<Product | Page> = ({ doc }) => {
  return doc?.title ? `${doc.title} | Payload Ecommerce Template` : 'Payload Ecommerce Template'
}

const generateURL: GenerateURL<Product | Page> = ({ doc }) => {
  const url = getServerSideURL()

  return doc?.slug ? `${url}/${doc.slug}` : url
}

const regenerateTransactionItemIDs: CollectionBeforeValidateHook<Transaction> = ({
  data,
  operation,
}) => {
  if (operation !== 'create' || !Array.isArray(data?.items)) {
    return data
  }

  return {
    ...data,
    items: data.items.map((item) => {
      const { id: _id, ...itemWithoutID } = item

      return itemWithoutID
    }),
  }
}

export const plugins: Plugin[] = [
  seoPlugin({
    generateTitle,
    generateURL,
  }),
  formBuilderPlugin({
    fields: {
      payment: false,
    },
    formSubmissionOverrides: {
      access: {
        delete: isAdmin,
        read: isAdmin,
        update: isAdmin,
      },
      admin: {
        group: 'Content',
      },
    },
    formOverrides: {
      access: {
        delete: isAdmin,
        read: isAdmin,
        update: isAdmin,
        create: isAdmin,
      },
      admin: {
        group: 'Content',
      },
      fields: ({ defaultFields }) => {
        return defaultFields.map((field) => {
          if ('name' in field && field.name === 'confirmationMessage') {
            return {
              ...field,
              editor: lexicalEditor({
                features: ({ rootFeatures }) => {
                  return [
                    ...rootFeatures,
                    FixedToolbarFeature(),
                    HeadingFeature({ enabledHeadingSizes: ['h1', 'h2', 'h3', 'h4'] }),
                  ]
                },
              }),
            }
          }
          return field
        })
      },
    },
  }),
  ecommercePlugin({
    access: {
      adminOnlyFieldAccess,
      adminOrPublishedStatus,
      customerOnlyFieldAccess,
      isAdmin,
      isDocumentOwner,
    },
    currencies: currenciesConfig,
    customers: {
      slug: 'users',
    },
    carts: {
      cartsCollectionOverride: ({ defaultCollection }) => ({
        ...defaultCollection,
        hooks: {
          ...defaultCollection.hooks,
          beforeValidate: [
            ...(defaultCollection.hooks?.beforeValidate || []),
            resolveCouponCodeBeforeValidate,
          ],
          beforeChange: [
            ...(defaultCollection.hooks?.beforeChange || []),
            applyCouponPreviewBeforeChange,
          ],
        },
        fields: [
          ...defaultCollection.fields,
          {
            name: 'appliedCoupon',
            type: 'relationship',
            admin: {
              position: 'sidebar',
              readOnly: true,
            },
            label: 'Applied coupon',
            relationTo: 'coupons',
          },
          {
            name: 'couponCode',
            type: 'text',
            admin: {
              position: 'sidebar',
            },
            label: 'Coupon code',
          },
          amountField({
            currenciesConfig,
            overrides: {
              name: 'couponDiscountAmount',
              admin: {
                position: 'sidebar',
                readOnly: true,
              },
              label: 'Coupon discount',
            },
          }),
          amountField({
            currenciesConfig,
            overrides: {
              name: 'couponTotal',
              admin: {
                position: 'sidebar',
                readOnly: true,
              },
              label: 'Total after coupon',
            },
          }),
        ],
      }),
    },
    orders: {
      ordersCollectionOverride: ({ defaultCollection }) => ({
        ...defaultCollection,
        hooks: {
          ...defaultCollection.hooks,
          afterChange: [
            ...(defaultCollection.hooks?.afterChange || []),
            sendOrderCreatedEmail,
            sendOrderCreatedAdminEmail,
          ],
        },
        fields: [
          ...defaultCollection.fields,
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
                ({ value, operation }) => {
                  if (operation === 'create' || !value) {
                    return crypto.randomUUID()
                  }
                  return value
                },
              ],
            },
          },
        ],
      }),
    },
    payments: {
      hooks: {
        beforeInitiatePayment: [applyCouponDiscount],
      },
      paymentMethods: [
        stripeAdapter({
          secretKey: process.env.STRIPE_SECRET_KEY!,
          publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
          webhookSecret: process.env.STRIPE_WEBHOOKS_SIGNING_SECRET!,
        }),
      ],
    },
    products: {
      productsCollectionOverride: ProductsCollection,
    },
    transactions: {
      transactionsCollectionOverride: ({ defaultCollection }) => ({
        ...defaultCollection,
        hooks: {
          ...defaultCollection.hooks,
          beforeValidate: [
            regenerateTransactionItemIDs,
            ...(defaultCollection.hooks?.beforeValidate ?? []),
          ],
        },
      }),
    },
  }),
]
