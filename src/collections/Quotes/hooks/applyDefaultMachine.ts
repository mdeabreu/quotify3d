import type { CollectionBeforeValidateHook } from 'payload'

import { resolveRelationID } from '@/collections/Quotes/relations'

// Ensures items have a machine selected; falls back to the first ordered machine record.
export const applyDefaultMachine: CollectionBeforeValidateHook = async ({ data, req }) => {
  if (!data || !Array.isArray(data.items)) {
    return data
  }

  const needsMachine = data.items.some(
    (item) => item && !resolveRelationID((item as { machine?: unknown }).machine),
  )

  if (!needsMachine) {
    return data
  }

  const machineConfigs = await req.payload.find({
    collection: 'machine-configs',
    depth: 0,
    limit: 1,
    sort: 'order',
    req,
    where: {
      active: {
        equals: true,
      },
    },
  })

  const defaultMachineConfig = machineConfigs.docs[0]
  if (!defaultMachineConfig?.id) {
    return data
  }

  return {
    ...data,
    items: data.items.map((item) => {
      if (!item) return item
      if (resolveRelationID((item as { machine?: unknown }).machine)) {
        return item
      }

      return {
        ...item,
        machine: defaultMachineConfig.id,
      }
    }),
  }
}
