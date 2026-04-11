import type { Field } from 'payload'

import { gcodeStatusOptions } from '@/collections/constants/gcodeStatusOptions'
import { currenciesConfig } from '@/config/currencies'
import { resolveRelationID } from '@/utilities/resolveRelationID'
import { amountField } from '@payloadcms/plugin-ecommerce'

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
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'gcode',
          type: 'relationship',
          relationTo: 'gcodes',
          admin: {
            readOnly: true,
          },
        },
        {
          name: 'gcodeStatus',
          type: 'select',
          options: gcodeStatusOptions,
          virtual: true,
          admin: {
            readOnly: true,
          },
          hooks: {
            afterRead: [
              async ({ req, siblingData }) => {
                const gcodeID = resolveRelationID((siblingData as { gcode?: unknown })?.gcode)
                if (typeof gcodeID !== 'number') return null

                try {
                  const gcode = await req.payload.findByID({
                    collection: 'gcodes',
                    id: gcodeID,
                    depth: 0,
                    req,
                    overrideAccess: true,
                    select: {
                      status: true,
                    },
                  })

                  return typeof gcode.status === 'string' ? gcode.status : null
                } catch {
                  return null
                }
              },
            ],
          },
        },
        amountField({
          currenciesConfig,
          overrides: {
            name: 'gcodePrice',
            label: 'Gcode Price',
            virtual: true,
            admin: {
              readOnly: true,
            },
            hooks: {
              afterRead: [
                async ({ req, siblingData }) => {
                  const gcodeID = resolveRelationID((siblingData as { gcode?: unknown })?.gcode)
                  if (typeof gcodeID !== 'number') return null

                  try {
                    const gcode = await req.payload.findByID({
                      collection: 'gcodes',
                      id: gcodeID,
                      depth: 0,
                      req,
                      overrideAccess: true,
                      select: {
                        priceOverride: true,
                        estimatedPrice: true,
                      },
                    })

                    if (typeof gcode.priceOverride === 'number') return gcode.priceOverride
                    if (typeof gcode.estimatedPrice === 'number') return gcode.estimatedPrice
                    return null
                  } catch {
                    return null
                  }
                },
              ],
            },
          },
        }),
        {
          name: 'gcodeWeight',
          type: 'number',
          label: 'Gcode Weight',
          virtual: true,
          admin: {
            readOnly: true,
          },
          hooks: {
            afterRead: [
              async ({ req, siblingData }) => {
                const gcodeID = resolveRelationID((siblingData as { gcode?: unknown })?.gcode)
                if (typeof gcodeID !== 'number') return null

                try {
                  const gcode = await req.payload.findByID({
                    collection: 'gcodes',
                    id: gcodeID,
                    depth: 0,
                    req,
                    overrideAccess: true,
                    select: {
                      weightOverride: true,
                      estimatedWeight: true,
                    },
                  })

                  if (typeof gcode.weightOverride === 'number') return gcode.weightOverride
                  if (typeof gcode.estimatedWeight === 'number') return gcode.estimatedWeight
                  return null
                } catch {
                  return null
                }
              },
            ],
          },
        },
        {
          name: 'gcodeDuration',
          type: 'number',
          label: 'Gcode Duration',
          virtual: true,
          admin: {
            readOnly: true,
          },
          hooks: {
            afterRead: [
              async ({ req, siblingData }) => {
                const gcodeID = resolveRelationID((siblingData as { gcode?: unknown })?.gcode)
                if (typeof gcodeID !== 'number') return null

                try {
                  const gcode = await req.payload.findByID({
                    collection: 'gcodes',
                    id: gcodeID,
                    depth: 0,
                    req,
                    overrideAccess: true,
                    select: {
                      durationOverride: true,
                      estimatedDuration: true,
                    },
                  })

                  if (typeof gcode.durationOverride === 'number') return gcode.durationOverride
                  if (typeof gcode.estimatedDuration === 'number') return gcode.estimatedDuration
                  return null
                } catch {
                  return null
                }
              },
            ],
          },
        },
      ],
    },
  ],
})
