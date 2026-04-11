export const formatDuration = (totalSeconds: number): string => {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const days = Math.floor(safeSeconds / 86400)
  const hours = Math.floor((safeSeconds % 86400) / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const seconds = safeSeconds % 60

  const parts: string[] = []
  if (days > 0) parts.push(`${days} day${days === 1 ? '' : 's'}`)
  if (hours > 0) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`)
  if (minutes > 0) parts.push(`${minutes} min`)
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds} sec`)

  return parts.join(', ')
}

export const formatWeight = (grams: number): string => {
  const safeGrams = Math.max(0, grams)
  if (safeGrams >= 1000) {
    const kilograms = safeGrams / 1000
    return `${safeGrams.toFixed(1)} g (${kilograms.toFixed(2)} kg)`
  }

  return `${safeGrams.toFixed(1)} g`
}
