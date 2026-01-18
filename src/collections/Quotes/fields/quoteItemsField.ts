import type { Field, Where } from 'payload'

import { amountField } from '@payloadcms/plugin-ecommerce'

import { ecommerceCurrenciesConfig } from '@/config/currencies'
import { gcodeStatusOptions } from '@/collections/constants/gcodeStatusOptions'
import { resolveRelationID } from '@/collections/Quotes/relations'

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
            width: '75%',
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
            width: '25%',
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'material',
          type: 'relationship',
          relationTo: 'materials',
          required: true,
          admin: {
            width: '33%',
          },
          filterOptions: ({ siblingData }) => {
            const { colour, filament } = (siblingData ?? {}) as {
              colour?: unknown
              filament?: unknown
            }

            const resolvedColour = resolveRelationID(colour)
            const resolvedFilament = resolveRelationID(filament)

            const constraints: Where[] = [
              {
                'filaments.active': {
                  equals: true,
                }
              }
            ]

            if (resolvedFilament) {
              constraints.push({
                filaments: {
                  contains: resolvedFilament,
                }
              })
            }

            if (resolvedColour) {
              constraints.push({
                'filaments.colour': {
                  equals: resolvedColour,
                }
              })
            }

            return {
              and: constraints,
            }
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
          filterOptions: ({ siblingData }) => {
            const { material, filament } = (siblingData ?? {}) as {
              material?: unknown
              filament?: unknown
            }

            const resolvedMaterial = resolveRelationID(material)
            const resolvedFilament = resolveRelationID(filament)

            const constraints: Where[] = [
              {
                'filaments.active': {
                  equals: true,
                }
              }
            ]

            if (resolvedFilament) {
              constraints.push({
                filaments: {
                  contains: resolvedFilament,
                }
              })
            }

            if (resolvedMaterial) {
              constraints.push({
                'filaments.material': {
                  equals: resolvedMaterial,
                }
              })
            }

            return {
              and: constraints,
            }
          },
        },
        {
          name: 'process',
          type: 'relationship',
          relationTo: 'processes',
          required: true,
          admin: {
            width: '34%',
          },
          filterOptions: () => {
            return {
              active: {
                equals: true,
              },
            }
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'filament',
          type: 'relationship',
          relationTo: 'filaments',
          admin: {
            position: 'sidebar',
            width: '50%',
          },
          filterOptions: ({ siblingData }) => {
            const { material, colour } = (siblingData ?? {}) as {
              material?: unknown
              colour?: unknown
            }

            const resolvedMaterial = resolveRelationID(material)
            const resolvedColour = resolveRelationID(colour)

            const constraints: Where[] = [
              {
                active: {
                  equals: true,
                },
              },
            ]

            if (resolvedMaterial) {
              constraints.push({
                material: {
                  equals: resolvedMaterial,
                },
              })
            }

            if (resolvedColour) {
              constraints.push({
                colour: {
                  equals: resolvedColour,
                },
              })
            }

            return {
              and: constraints,
            }
          },
        },
        {
          name: 'machine',
          type: 'relationship',
          relationTo: 'machine-configs',
          admin: {
            width: '50%',
          },
          filterOptions: () => {
            return {
              active: {
                equals: true,
              },
            }
          },
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
            width: '50%',
          },
        },
        {
          name: 'gcodeStatus',
          label: 'Status',
          type: 'select',
          virtual: true,
          options: gcodeStatusOptions,
          hooks: {
            afterRead: [async ({ siblingData, req }) => {
              const gcodeId = resolveRelationID(siblingData?.gcode)

              if (!gcodeId) {
                return null
              }

              try {
                const gcode = await req.payload.findByID({
                  collection: 'gcodes',
                  id: gcodeId,
                  depth: 0,
                  req,
                })

                if (typeof gcode.status === 'string') {
                  return gcode.status
                }
              } catch {
                // ignore and fall back to null
              }

              return null
            }],
          },
          admin: {
            width: '50%',
            readOnly: true,
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'grams',
          type: 'number',
          virtual: true,
          hooks: {
            afterRead: [async ({ siblingData, req, value }) => {
              const gcodeId = resolveRelationID(siblingData?.gcode)

              if (!gcodeId) {
                return value
              }

              try {
                const gcode = await req.payload.findByID({
                  collection: 'gcodes',
                  id: gcodeId,
                  depth: 0,
                  req,
                })

                if (typeof gcode.estimatedWeight === 'number') {
                  return gcode.estimatedWeight
                }
              } catch {
                // ignore and fall back to existing value
              }

              return value
            }],
          },
          admin: {
            width: '50%',
            readOnly: true,
          },
        },
        {
          name: 'duration',
          type: 'number',
          virtual: true,
          hooks: {
            afterRead: [async ({ siblingData, req, value }) => {
              const gcodeId = resolveRelationID(siblingData?.gcode)

              if (!gcodeId) {
                return value
              }

              try {
                const gcode = await req.payload.findByID({
                  collection: 'gcodes',
                  id: gcodeId,
                  depth: 0,
                  req,
                })

                if (typeof gcode.estimatedDuration === 'number') {
                  return gcode.estimatedDuration
                }
              } catch {
                // ignore and fall back to existing value
              }

              return value
            }],
          },
          admin: {
            width: '50%',
            readOnly: true,
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        amountField({
          currenciesConfig: ecommerceCurrenciesConfig,
          overrides: {
            name: 'lineAmount',
            label: 'Subtotal',
            admin: {
              readOnly: true,
              width: '50%',
            },
          },
        }),
        amountField({
          currenciesConfig: ecommerceCurrenciesConfig,
          overrides: {
            name: 'priceOverride',
            label: 'Price override',
            min: 0,
            admin: {
              width: '50%',
            },
          },
        }),
      ],
    },
  ],
})
