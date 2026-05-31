import type { CollectionBeforeChangeHook } from 'payload'

import { calculateGcodePrice } from '@/jobs/workflows/helpers/gcodeHelpers'
import { resolveRelationID } from '@/utilities/resolveRelationID'

type GcodeData = Record<string, unknown>

const toFiniteNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined

const hasChanged = (field: string, data: GcodeData, originalDoc?: GcodeData | null) =>
  field in data &&
  (toFiniteNumber(data[field]) ?? null) !== (toFiniteNumber(originalDoc?.[field]) ?? null)

const resolveNumber = (field: string, data: GcodeData, originalDoc?: GcodeData | null) =>
  toFiniteNumber(field in data ? data[field] : originalDoc?.[field])

export const recalculatePriceOverrideFromMetricOverrides: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  req,
}) => {
  if (!data) {
    return data
  }

  const nextData = data as GcodeData
  const previousData = originalDoc as GcodeData | null | undefined
  const metricOverrideChanged =
    hasChanged('weightOverride', nextData, previousData) ||
    hasChanged('durationOverride', nextData, previousData)

  if (!metricOverrideChanged || hasChanged('priceOverride', nextData, previousData)) {
    return data
  }

  const weightOverride = resolveNumber('weightOverride', nextData, previousData)
  const durationOverride = resolveNumber('durationOverride', nextData, previousData)

  if (typeof weightOverride !== 'number' && typeof durationOverride !== 'number') {
    data.priceOverride = null
    return data
  }

  const filamentId = resolveRelationID(nextData.filament ?? previousData?.filament)
  const machineId = resolveRelationID(nextData.machine ?? previousData?.machine)

  const priceOverride = await calculateGcodePrice({
    req,
    filamentId,
    machineId,
    totalEstimatedWeight: resolveNumber('estimatedWeight', nextData, previousData) ?? 0,
    totalEstimatedDuration: resolveNumber('estimatedDuration', nextData, previousData) ?? 0,
    weightOverride,
    durationOverride,
  })

  data.priceOverride = priceOverride ?? null

  return data
}
