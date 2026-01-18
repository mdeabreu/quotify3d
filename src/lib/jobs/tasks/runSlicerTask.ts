import { execFile } from 'child_process'
import fs from 'fs/promises'
import path from 'path'
import type { TaskHandler } from 'payload'
import { promisify } from 'util'

import { resolveRelationID } from '@/collections/Quotes/relations'

const execFileAsync = promisify(execFile)
const ORCA_BINARY = '/Applications/OrcaSlicer.app/Contents/MacOS/OrcaSlicer'

export const runSlicerTask: TaskHandler<'runSlicer'> = async ({ input, req }) => {
  const { gcodeId, filamentConfigPath, processConfigPath, machineConfigPath } = input || {}

  if (!gcodeId) {
    throw new Error('runSlicer: gcodeId is required')
  }

  if (!filamentConfigPath || !processConfigPath || !machineConfigPath) {
    throw new Error('runSlicer: missing config paths; ensure collectSliceContext ran successfully')
  }

  const gcode = await req.payload.findByID({
    collection: 'gcodes',
    id: gcodeId,
    depth: 0,
  })

  const modelId = resolveRelationID(gcode.model)
  if (!modelId) {
    throw new Error('runSlicer: gcode is missing model reference')
  }

  const model = await req.payload.findByID({
    collection: 'models',
    id: modelId,
    depth: 0,
  })

  const filename = (model as { filename?: string }).filename
  if (!filename) {
    throw new Error('runSlicer: model is missing filename')
  }

  const modelPath = path.join(process.cwd(), 'data', 'models', filename)
  try {
    await fs.access(modelPath)
  } catch {
    throw new Error(`runSlicer: model file not found at ${modelPath}`)
  }

  const outputDir = path.join(process.cwd(), 'data', 'tmp', 'slicing', String(gcodeId), 'output')
  await fs.mkdir(outputDir, { recursive: true })

  const args = [
    '--info',
    '--arrange',
    '1',
    '--orient',
    '1',
    '--slice',
    '0',
    '--load-filaments',
    filamentConfigPath,
    '--load-settings',
    `${processConfigPath};${machineConfigPath}`,
    '--outputdir',
    outputDir,
    modelPath,
  ]

  const commandString = [ORCA_BINARY, ...args.map((arg) => (/\s/.test(arg) ? `"${arg}"` : arg))].join(' ')
  await req.payload.update({
    collection: 'gcodes',
    id: gcodeId,
    data: {
      slicingCommand: commandString,
    },
    depth: 0,
    context: {
      skipQueueSliceWorkflow: true,
    },
  })

  let slicerOutput = ''
  try {
    const { stdout, stderr } = await execFileAsync(ORCA_BINARY, args, {
      maxBuffer: 10 * 1024 * 1024,
    })
    slicerOutput = [stdout, stderr].filter(Boolean).join('\n').trim()
  } catch (error) {
    const err = error as Error & { stdout?: string; stderr?: string }
    const combinedOutput = [err.stdout, err.stderr].filter(Boolean).join('\n').trim()
    const message = combinedOutput ? `${err.message} | Output: ${combinedOutput}` : err.message
    throw new Error(`runSlicer: failed to execute OrcaSlicer: ${message}`)
  }

  const files = await fs.readdir(outputDir)
  const gcodeFiles = files.filter((file) => file.toLowerCase().endsWith('.gcode'))
  if (gcodeFiles.length === 0) {
    throw new Error('runSlicer: sliced G-code not found in output directory')
  }

  const slicedGcodePaths = gcodeFiles.map((file) => path.join(outputDir, file))

  return {
    output: {
      gcodePaths: slicedGcodePaths,
      slicerOutput,
    },
  }
}
