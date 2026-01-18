export const resolveRelationID = (value: unknown): number | string | undefined => {
  if (value === null || value === undefined) return undefined

  if (typeof value === 'string' || typeof value === 'number') {
    return value
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (typeof record.id === 'string' || typeof record.id === 'number') {
      return record.id
    }

    if (typeof record.value === 'string' || typeof record.value === 'number') {
      return record.value
    }
  }

  return undefined
}
