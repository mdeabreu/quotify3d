import { execFile } from 'child_process'
import fs from 'fs/promises'
import path from 'path'
import type { PayloadRequest } from 'payload'
import { promisify } from 'util'

import { toMinorUnitAmount } from '@/utilities/currency'
import { resolveRelationID } from '@/utilities/resolveRelationID'

type JSONObject = Record<string, unknown>

const execFileAsync = promisify(execFile)
const CONTAINER_ORCA_BINARY = '/opt/orcaslicer/AppRun'
const MAC_ORCA_BINARY = '/Applications/OrcaSlicer.app/Contents/MacOS/OrcaSlicer'

const getOrcaBinary = () =>
  process.env.SLICER_BINARY_PATH ||
  (process.platform === 'darwin' ? MAC_ORCA_BINARY : CONTAINER_ORCA_BINARY)

const FILAMENT_REGEX = /; filament used \[g\]\s*=\s*([^\r\n]+)/i
const DURATION_LINE_REGEX = /; total estimated time:\s*([^\r\n]+)/i
const DURATION_TOKEN_REGEX = /(\d+)\s*([hms])/gi
const SLICER_ATTEMPT_OUTPUT_MAX_LENGTH = 2000

type SlicerAttempt = {
  label: string
  repairArgs: string[]
}

type FailedSlicerAttempt = {
  label: string
  commandString: string
  message: string
  output?: string
}

const SLICER_ATTEMPTS: SlicerAttempt[] = [
  { label: 'as-uploaded', repairArgs: [] },
  { label: 'ensure-on-bed', repairArgs: ['--ensure-on-bed'] },
  { label: 'arrange', repairArgs: ['--ensure-on-bed', '--arrange', '1'] },
  { label: 'orient', repairArgs: ['--ensure-on-bed', '--orient', '1'] },
  {
    label: 'full-auto-repair',
    repairArgs: ['--ensure-on-bed', '--arrange', '1', '--orient', '1'],
  },
]

const isObject = (value: unknown): value is JSONObject => {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

const writeConfigFile = async (dir: string, filename: string, payload: JSONObject) => {
  await fs.mkdir(dir, { recursive: true })
  const fullPath = path.join(dir, filename)
  await fs.writeFile(fullPath, JSON.stringify(payload, null, 2), 'utf-8')
  return fullPath
}

const getSlicerOutput = (stdout?: string | Buffer | null, stderr?: string | Buffer | null) => {
  return [stdout, stderr]
    .filter((output): output is string | Buffer => Boolean(output))
    .map((output) => output.toString())
    .join('\n')
    .trim()
}

const truncateSlicerOutput = (output?: string) => {
  if (!output) return undefined
  if (output.length <= SLICER_ATTEMPT_OUTPUT_MAX_LENGTH) return output

  return `${output.slice(0, SLICER_ATTEMPT_OUTPUT_MAX_LENGTH)}...`
}

const formatSlicerCommand = (args: string[]) => {
  return [getOrcaBinary(), ...args.map((arg) => (/\s/.test(arg) ? `"${arg}"` : arg))].join(' ')
}

const buildSlicerArgs = ({
  attempt,
  modelPath,
  outputDir,
  filamentConfigPath,
  processConfigPath,
  machineConfigPath,
}: {
  attempt: SlicerAttempt
  modelPath: string
  outputDir: string
  filamentConfigPath: string
  processConfigPath: string
  machineConfigPath: string
}) => {
  return [
    '--info',
    ...attempt.repairArgs,
    '--slice',
    '0',
    '--allow-newer-file',
    '--load-filaments',
    filamentConfigPath,
    '--load-settings',
    processConfigPath,
    '--load-settings',
    machineConfigPath,
    '--outputdir',
    outputDir,
    modelPath,
  ]
}

const formatFailedSlicerAttempts = (attempts: FailedSlicerAttempt[]) => {
  return attempts
    .map((attempt, index) => {
      const parts = [
        `${index + 1}. ${attempt.label}`,
        `Command: ${attempt.commandString}`,
        `Error: ${attempt.message}`,
      ]

      if (attempt.output) {
        parts.push(`Output: ${attempt.output}`)
      }

      return parts.join('\n')
    })
    .join('\n\n')
}

export const cleanSlicingWorkspace = async (gcodeId: string | number) => {
  const dir = path.join(process.cwd(), 'data', 'tmp', 'slicing', String(gcodeId))
  await fs.rm(dir, { recursive: true, force: true })
}

export const resetGcodeSlicingResults = async ({
  req,
  gcodeId,
}: {
  req: PayloadRequest
  gcodeId: string | number
}) => {
  await req.payload.update({
    collection: 'gcodes',
    id: gcodeId,
    data: {
      plates: [],
      estimatedWeight: null,
      estimatedDuration: null,
      estimatedPrice: null,
      slicingCommand: null,
      slicerOutput: null,
      error: null,
    },
    depth: 0,
  })
}

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

const stripExecutableBlocks = (contents: string) => {
  const startMarker = '; EXECUTABLE_BLOCK_START'
  const endMarker = '; EXECUTABLE_BLOCK_END'
  const lines = contents.split(/\r?\n/)

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
}

const parseGcodeFile = (contents: string) => {
  let filamentUsedGrams: number | undefined
  const filamentMatch = contents.match(FILAMENT_REGEX)
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
  const durationMatch = contents.match(DURATION_LINE_REGEX)
  if (durationMatch?.[1]) {
    estimatedDuration = parseDurationToSeconds(durationMatch[1])
  }

  return {
    filamentUsedGrams,
    estimatedDuration,
    filteredContents: stripExecutableBlocks(contents),
  }
}

export const buildSlicerContext = async ({
  req,
  gcodeId,
}: {
  req: PayloadRequest
  gcodeId: string | number
}) => {
  const gcode = await req.payload.findByID({
    collection: 'gcodes',
    id: gcodeId,
    depth: 0,
  })

  const filamentId = resolveRelationID(gcode.filament)
  const processId = resolveRelationID(gcode.process)
  const machineId = resolveRelationID(gcode.machine)

  if (!filamentId || !processId || !machineId) {
    throw new Error('buildSlicerContext: gcode is missing filament, process, or machine reference')
  }

  const [filament, processDoc, machine] = await Promise.all([
    req.payload.findByID({ collection: 'filaments', id: filamentId, depth: 0 }),
    req.payload.findByID({ collection: 'processes', id: processId, depth: 0 }),
    req.payload.findByID({ collection: 'machines', id: machineId, depth: 0 }),
  ])

  const filamentConfigId = resolveRelationID((filament as { config?: unknown }).config)
  const processConfigId = resolveRelationID((processDoc as { config?: unknown }).config)
  const machineConfigId = resolveRelationID((machine as { config?: unknown }).config)

  if (!filamentConfigId || !processConfigId || !machineConfigId) {
    throw new Error('buildSlicerContext: missing filament, process, or machine config reference')
  }

  const [filamentConfigDoc, processConfigDoc, machineConfigDoc] = await Promise.all([
    req.payload.findByID({ collection: 'filament-configs', id: filamentConfigId, depth: 0 }),
    req.payload.findByID({ collection: 'process-configs', id: processConfigId, depth: 0 }),
    req.payload.findByID({ collection: 'machine-configs', id: machineConfigId, depth: 0 }),
  ])

  const filamentConfig = (
    isObject((filamentConfigDoc as { config?: unknown }).config)
      ? (filamentConfigDoc as { config?: unknown }).config
      : {}
  ) as JSONObject

  const processConfig = (
    isObject((processConfigDoc as { config?: unknown }).config)
      ? (processConfigDoc as { config?: unknown }).config
      : {}
  ) as JSONObject

  const machineConfig = (
    isObject((machineConfigDoc as { config?: unknown }).config)
      ? (machineConfigDoc as { config?: unknown }).config
      : {}
  ) as JSONObject

  const dir = path.join(process.cwd(), 'data', 'tmp', 'slicing', String(gcodeId))

  const [filamentConfigPath, processConfigPath, machineConfigPath] = await Promise.all([
    writeConfigFile(dir, 'filament.json', filamentConfig),
    writeConfigFile(dir, 'process.json', processConfig),
    writeConfigFile(dir, 'machine.json', machineConfig),
  ])

  return {
    filamentConfigPath,
    processConfigPath,
    machineConfigPath,
  }
}

export const sliceModel = async ({
  modelPath,
  outputDir,
  filamentConfigPath,
  processConfigPath,
  machineConfigPath,
}: {
  modelPath: string
  outputDir: string
  filamentConfigPath: string
  processConfigPath: string
  machineConfigPath: string
}) => {
  const failedAttempts: FailedSlicerAttempt[] = []

  for (const attempt of SLICER_ATTEMPTS) {
    console.info(`[sliceModel] Trying OrcaSlicer attempt: ${attempt.label}`)

    await fs.rm(outputDir, { recursive: true, force: true })
    await fs.mkdir(outputDir, { recursive: true })

    const args = buildSlicerArgs({
      attempt,
      modelPath,
      outputDir,
      filamentConfigPath,
      processConfigPath,
      machineConfigPath,
    })
    const commandString = formatSlicerCommand(args)

    let slicerOutput = ''
    try {
      const { stdout, stderr } = await execFileAsync(getOrcaBinary(), args, {
        maxBuffer: 10 * 1024 * 1024,
      })
      slicerOutput = getSlicerOutput(stdout, stderr)
    } catch (error) {
      const err = error as Error & { stdout?: string | Buffer; stderr?: string | Buffer }
      failedAttempts.push({
        label: attempt.label,
        commandString,
        message: err.message,
        output: truncateSlicerOutput(getSlicerOutput(err.stdout, err.stderr)),
      })
      console.warn(`[sliceModel] OrcaSlicer attempt failed: ${attempt.label}`)
      continue
    }

    const files = await fs.readdir(outputDir)
    const gcodeFiles = files.filter((file) => file.toLowerCase().endsWith('.gcode'))
    if (gcodeFiles.length === 0) {
      failedAttempts.push({
        label: attempt.label,
        commandString,
        message: 'Sliced G-code not found in output directory',
        output: truncateSlicerOutput(slicerOutput),
      })
      console.warn(`[sliceModel] OrcaSlicer attempt produced no G-code: ${attempt.label}`)
      continue
    }

    const slicedGcodePaths = gcodeFiles.map((file) => path.join(outputDir, file))
    console.info(
      `[sliceModel] OrcaSlicer attempt succeeded: ${attempt.label} (${slicedGcodePaths.length} file${slicedGcodePaths.length === 1 ? '' : 's'})`,
    )

    return {
      slicerOutput,
      gcodePaths: slicedGcodePaths,
      commandString,
    }
  }

  throw new Error(
    `sliceModel: all OrcaSlicer attempts failed\n\n${formatFailedSlicerAttempts(failedAttempts)}`,
  )
}

export const parseGcodeOutputs = async (gcodePaths: string[]) => {
  const plates = []

  for (const gcodePath of gcodePaths) {
    const contents = await fs.readFile(gcodePath, 'utf-8')
    const parsed = parseGcodeFile(contents)

    plates.push({
      estimatedWeight: parsed.filamentUsedGrams,
      estimatedDuration: parsed.estimatedDuration,
      gcode: parsed.filteredContents,
    })
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

  return {
    plates,
    totalEstimatedWeight,
    totalEstimatedDuration,
  }
}

export const calculateGcodePrice = async ({
  req,
  filamentId,
  machineId,
  totalEstimatedWeight,
  totalEstimatedDuration,
  weightOverride,
  durationOverride,
}: {
  req: PayloadRequest
  filamentId?: string | number | null
  machineId?: string | number | null
  totalEstimatedWeight: number
  totalEstimatedDuration: number
  weightOverride?: number
  durationOverride?: number
}) => {
  const weightForPrice = weightOverride ?? totalEstimatedWeight
  const durationForPrice = durationOverride ?? totalEstimatedDuration

  let materialCost = 0
  if (filamentId && weightForPrice > 0) {
    const filament = await req.payload.findByID({
      collection: 'filaments',
      id: filamentId,
      depth: 0,
    })

    if (typeof filament.pricePerGram === 'number' && filament.pricePerGram > 0) {
      materialCost = filament.pricePerGram * weightForPrice
    }
  }

  let timeCost = 0
  if (machineId && durationForPrice > 0) {
    const machine = await req.payload.findByID({
      collection: 'machines',
      id: machineId,
      depth: 0,
    })

    if (typeof machine.pricePerHour === 'number' && machine.pricePerHour > 0) {
      timeCost = machine.pricePerHour * (durationForPrice / 3600)
    }
  }

  const totalCost = materialCost + timeCost
  if (totalCost <= 0) {
    return undefined
  }

  return toMinorUnitAmount(totalCost)
}

export const updateGcodeFromResults = async ({
  req,
  gcodeId,
  slicingCommand,
  slicerOutput,
  plates,
  totalEstimatedWeight,
  totalEstimatedDuration,
  estimatedPrice,
}: {
  req: PayloadRequest
  gcodeId: string | number
  slicingCommand?: string | null
  slicerOutput?: string | null
  plates: {
    estimatedWeight?: number | null
    estimatedDuration?: number | null
    gcode?: string | null
  }[]
  totalEstimatedWeight?: number
  totalEstimatedDuration?: number
  estimatedPrice?: number
}) => {
  await req.payload.update({
    collection: 'gcodes',
    id: gcodeId,
    data: {
      slicingCommand: slicingCommand ?? undefined,
      slicerOutput: slicerOutput ?? undefined,
      plates,
      estimatedWeight: totalEstimatedWeight || undefined,
      estimatedDuration: totalEstimatedDuration || undefined,
      estimatedPrice,
    },
    depth: 0,
  })
}
