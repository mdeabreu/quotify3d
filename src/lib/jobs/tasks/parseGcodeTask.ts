import fs from 'fs/promises'
import type { TaskHandler } from 'payload'

const FILAMENT_REGEX = /; filament used \[g\]\s*=\s*([^\r\n]+)/i
const DURATION_LINE_REGEX = /; total estimated time:\s*([^\r\n]+)/i
const DURATION_TOKEN_REGEX = /(\d+)\s*([hms])/gi

const parseDurationToSeconds = (raw: string): number | undefined => {
  let seconds = 0
  let matched = false

  for (const token of raw.matchAll(DURATION_TOKEN_REGEX)) {
    const value = Number(token[1])
    const unit = token[2].toLowerCase()

    if (Number.isNaN(value)) continue
    matched = true

    if (unit === 'h') {
      seconds += value * 3600
      continue
    }

    if (unit === 'm') {
      seconds += value * 60
      continue
    }

    if (unit === 's') {
      seconds += value
    }
  }

  return matched ? seconds : undefined
}

export const parseGcodeTask: TaskHandler<'parseGcode'> = async ({ input, req }) => {
  const gcodeId = input?.gcodeId
  const gcodePath = input?.gcodePath
  const plateIndex = input?.index

  if (!gcodeId) {
    throw new Error('parseGcode: gcodeId is required')
  }

  if (!gcodePath) {
    throw new Error('parseGcode: gcodePath is required')
  }

  const index = Number(plateIndex)
  if (!Number.isInteger(index) || index < 0) {
    throw new Error('parseGcode: index must be a non-negative integer')
  }

  const fileContents = await fs.readFile(gcodePath, 'utf-8')
  const filteredContents = (() => {
    const startMarker = '; EXECUTABLE_BLOCK_START'
    const endMarker = '; EXECUTABLE_BLOCK_END'
    const lines = fileContents.split(/\r?\n/)

    let inExecutableBlock = false
    const kept: string[] = []

    for (const line of lines) {
      if (line.trim() === startMarker) {
        inExecutableBlock = true
        continue
      }

      if (line.trim() === endMarker) {
        inExecutableBlock = false
        continue
      }

      if (inExecutableBlock) {
        continue
      }

      kept.push(line)
    }

    return kept.join('\n')
  })()

  let filamentUsedGrams: number | undefined
  const filamentMatch = fileContents.match(FILAMENT_REGEX)
  if (filamentMatch?.[1]) {
    const matches = filamentMatch[1].match(/-?\d+(?:\.\d+)?/g)
    if (matches) {
      const total = matches.reduce((sum, value) => {
        const parsed = Number(value)
        if (Number.isNaN(parsed)) return sum
        return sum + parsed
      }, 0)

      if (!Number.isNaN(total)) {
        filamentUsedGrams = total
      }
    }
  }

  let estimatedDuration: number | undefined
  const durationMatch = fileContents.match(DURATION_LINE_REGEX)
  if (durationMatch?.[1]) {
    estimatedDuration = parseDurationToSeconds(durationMatch[1])
  }

  const gcode = await req.payload.findByID({
    collection: 'gcodes',
    id: gcodeId,
    depth: 0,
  })

  const plates = Array.isArray(gcode.plates) ? [...gcode.plates] : []
  while (plates.length <= index) {
    plates.push({})
  }

  const currentPlate = plates[index] ?? {}

  plates[index] = {
    ...currentPlate,
    estimatedWeight: filamentUsedGrams,
    estimatedDuration,
    gcode: filteredContents,
  }

  const totalEstimatedWeight = plates.reduce<number>((total, plate) => {
    if (!plate || typeof plate.estimatedWeight !== 'number') {
      return total
    }
    return total + plate.estimatedWeight
  }, 0)

  const totalEstimatedDuration = plates.reduce<number>((total, plate) => {
    if (!plate || typeof plate.estimatedDuration !== 'number') {
      return total
    }
    return total + plate.estimatedDuration
  }, 0)

  await req.payload.update({
    collection: 'gcodes',
    id: gcodeId,
    data: {
      plates,
      estimatedWeight: totalEstimatedWeight || undefined,
      estimatedDuration: totalEstimatedDuration || undefined,
    },
    depth: 0,
    context: {
      skipQueueSliceWorkflow: true,
    },
  })

  return {
    output: {
      filamentUsedGrams,
      estimatedDuration,
    },
  }
}
