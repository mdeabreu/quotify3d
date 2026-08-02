import fs from 'fs/promises'
import fsSync from 'fs'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockExecFile = vi.hoisted(() => {
  const execFile = vi.fn()
  const promisifyCustom: symbol = Symbol.for('nodejs.util.promisify.custom')
  ;(
    execFile as unknown as Record<
      symbol,
      (binary: string, args: string[], options: unknown) => Promise<unknown>
    >
  )[promisifyCustom] = (binary: string, args: string[], options: unknown) => {
    return new Promise((resolve, reject) => {
      execFile(binary, args, options, (error: Error | null, stdout?: string, stderr?: string) => {
        if (error) {
          reject(error)
          return
        }

        resolve({ stdout, stderr })
      })
    })
  }

  return execFile
})

vi.mock('child_process', () => ({
  default: {
    execFile: mockExecFile,
  },
  execFile: mockExecFile,
}))

import { buildSlicerContext, sliceModel } from '@/jobs/workflows/helpers/gcodeHelpers'

const tempDirs: string[] = []
const originalSlicerBinaryPath = process.env.SLICER_BINARY_PATH
type ExecFileCallback = (error: Error | null, stdout?: string, stderr?: string) => void

const restoreSlicerBinaryPath = () => {
  if (originalSlicerBinaryPath === undefined) {
    delete process.env.SLICER_BINARY_PATH
    return
  }

  process.env.SLICER_BINARY_PATH = originalSlicerBinaryPath
}

const createSlicePaths = async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'quotify3d-slice-model-'))
  tempDirs.push(tempDir)

  return {
    tempDir,
    modelPath: path.join(tempDir, 'model.stl'),
    outputDir: path.join(tempDir, 'output'),
    filamentConfigPath: path.join(tempDir, 'filament.json'),
    processConfigPath: path.join(tempDir, 'process.json'),
    machineConfigPath: path.join(tempDir, 'machine.json'),
  }
}

const getOutputDir = (args: string[]) => {
  const outputDirIndex = args.indexOf('--outputdir')
  if (outputDirIndex === -1) {
    throw new Error('Expected slicer args to include --outputdir')
  }

  return args[outputDirIndex + 1]
}

const writeGcodeForArgs = (args: string[], filename = 'plate-1.gcode') => {
  const outputDir = getOutputDir(args)
  fsSync.mkdirSync(outputDir, { recursive: true })
  fsSync.writeFileSync(path.join(outputDir, filename), '; total estimated time: 1m\n', 'utf-8')
}

beforeEach(() => {
  mockExecFile.mockReset()
  restoreSlicerBinaryPath()
})

afterEach(async () => {
  restoreSlicerBinaryPath()

  for (const tempDir of tempDirs.splice(0)) {
    await fs.rm(tempDir, { force: true, recursive: true })
  }
})

describe('sliceModel', () => {
  it('normalizes PrusaSlicer paint attributes before slicing a 3MF', async () => {
    const paths = await createSlicePaths()
    paths.modelPath = path.join(paths.tempDir, 'painted.3mf')
    paths.filamentConfigPath = `${paths.filamentConfigPath};${path.join(paths.tempDir, 'filament-2.json')}`
    await fs.writeFile(
      paths.modelPath,
      zipSync({
        '3D/3dmodel.model': strToU8(
          '<triangle v1="0" v2="1" v3="2" slic3rpe:mmu_segmentation="1"/>',
        ),
      }),
    )

    mockExecFile.mockImplementation(
      (_binary: string, args: string[], _options: unknown, callback: ExecFileCallback) => {
        const preparedModelPath = args.at(-1)
        expect(preparedModelPath).not.toBe(paths.modelPath)

        const archive = unzipSync(fsSync.readFileSync(preparedModelPath!))
        const modelXml = strFromU8(archive['3D/3dmodel.model'])
        expect(modelXml).toContain('paint_color="1"')
        expect(modelXml).not.toContain('slic3rpe:mmu_segmentation')

        writeGcodeForArgs(args)
        callback(null, 'normalized', '')
      },
    )

    const result = await sliceModel(paths)

    expect(result.commandString).toContain('slicer-model.3mf')
  })

  it('passes a single-colour non-Bambu 3MF through without rewriting it', async () => {
    const paths = await createSlicePaths()
    paths.modelPath = path.join(paths.tempDir, 'painted.3mf')
    await fs.writeFile(
      paths.modelPath,
      zipSync({
        '3D/3dmodel.model': strToU8('<triangle v1="0" v2="1" v3="2" paint_color="1"/>'),
      }),
    )

    mockExecFile.mockImplementation(
      (_binary: string, args: string[], _options: unknown, callback: ExecFileCallback) => {
        expect(args.at(-1)).toBe(paths.modelPath)
        writeGcodeForArgs(args)
        callback(null, 'native', '')
      },
    )

    await sliceModel(paths)
  })

  it('flattens only model colour assignments for a single-colour Bambu project', async () => {
    const paths = await createSlicePaths()
    paths.modelPath = path.join(paths.tempDir, 'painted.3mf')
    const projectSettings = '{"enable_prime_tower":"1"}'
    await fs.writeFile(
      paths.modelPath,
      zipSync({
        '3D/Objects/object.model': strToU8('<triangle v1="0" v2="1" v3="2" paint_color="1"/>'),
        'Metadata/model_settings.config': strToU8('<metadata key="extruder" value="3"/>'),
        'Metadata/project_settings.config': strToU8(projectSettings),
      }),
    )

    mockExecFile.mockImplementation(
      (_binary: string, args: string[], _options: unknown, callback: ExecFileCallback) => {
        const preparedModelPath = args.at(-1)
        const archive = unzipSync(fsSync.readFileSync(preparedModelPath!))

        expect(strFromU8(archive['3D/Objects/object.model'])).not.toContain('paint_color')
        expect(strFromU8(archive['Metadata/model_settings.config'])).toContain(
          'key="extruder" value="1"',
        )
        expect(strFromU8(archive['Metadata/project_settings.config'])).toBe(projectSettings)

        writeGcodeForArgs(args)
        callback(null, 'flattened', '')
      },
    )

    await sliceModel(paths)
  })

  it('returns the baseline command and output when the uploaded model slices successfully', async () => {
    const paths = await createSlicePaths()

    mockExecFile.mockImplementation(
      (_binary: string, args: string[], _options: unknown, callback: ExecFileCallback) => {
        writeGcodeForArgs(args)
        callback(null, 'baseline stdout', 'baseline stderr')
      },
    )

    const result = await sliceModel(paths)

    expect(mockExecFile).toHaveBeenCalledTimes(1)
    expect(mockExecFile).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Array),
      expect.objectContaining({ cwd: paths.outputDir }),
      expect.any(Function),
    )
    expect(result.slicerOutput).toBe('baseline stdout\nbaseline stderr')
    expect(result.gcodePaths).toHaveLength(1)
    expect(result.commandString).toContain('--slice 0')
    expect(result.commandString).not.toContain('--ensure-on-bed')
    expect(result.commandString).not.toContain('--arrange')
    expect(result.commandString).not.toContain('--orient')
  })

  it('uses the configured slicer binary path for execution and command recording', async () => {
    process.env.SLICER_BINARY_PATH = '/opt/orcaslicer/AppRun'
    const paths = await createSlicePaths()

    mockExecFile.mockImplementation(
      (_binary: string, args: string[], _options: unknown, callback: ExecFileCallback) => {
        writeGcodeForArgs(args)
        callback(null, 'configured binary stdout', '')
      },
    )

    const result = await sliceModel(paths)

    expect(mockExecFile).toHaveBeenCalledWith(
      '/opt/orcaslicer/AppRun',
      expect.any(Array),
      expect.any(Object),
      expect.any(Function),
    )
    expect(result.commandString).toContain('/opt/orcaslicer/AppRun --info')
  })

  it('returns only the successful retry output and command after an earlier failure', async () => {
    const paths = await createSlicePaths()

    mockExecFile
      .mockImplementationOnce(
        (_binary: string, _args: string[], _options: unknown, callback: ExecFileCallback) => {
          const error = Object.assign(new Error('baseline failed'), {
            stdout: 'stale info stdout',
            stderr: 'stale info stderr',
          })
          callback(error)
        },
      )
      .mockImplementationOnce(
        (_binary: string, args: string[], _options: unknown, callback: ExecFileCallback) => {
          writeGcodeForArgs(args)
          callback(null, 'successful info stdout', 'successful info stderr')
        },
      )

    const result = await sliceModel(paths)

    expect(mockExecFile).toHaveBeenCalledTimes(2)
    expect(result.slicerOutput).toBe('successful info stdout\nsuccessful info stderr')
    expect(result.slicerOutput).not.toContain('stale info')
    expect(result.commandString).toContain('--ensure-on-bed')
    expect(result.commandString).not.toContain('--arrange')
    expect(result.commandString).not.toContain('--orient')
  })

  it('does not allow stale gcode from a failed attempt to satisfy a later attempt', async () => {
    const paths = await createSlicePaths()

    mockExecFile
      .mockImplementationOnce(
        (_binary: string, args: string[], _options: unknown, callback: ExecFileCallback) => {
          writeGcodeForArgs(args, 'stale.gcode')
          const error = Object.assign(new Error('failed after writing partial output'), {
            stdout: 'partial stdout',
          })
          callback(error)
        },
      )
      .mockImplementation(
        (_binary: string, _args: string[], _options: unknown, callback: ExecFileCallback) => {
          callback(null, 'completed without gcode', '')
        },
      )

    await expect(sliceModel(paths)).rejects.toThrow('sliceModel: all OrcaSlicer attempts failed')

    const outputFiles = await fs.readdir(paths.outputDir)
    expect(outputFiles).not.toContain('stale.gcode')
  })

  it('includes every failed attempt label and truncated output when all attempts fail', async () => {
    const paths = await createSlicePaths()
    const longOutput = 'x'.repeat(2100)

    mockExecFile.mockImplementation(
      (_binary: string, _args: string[], _options: unknown, callback: ExecFileCallback) => {
        const error = Object.assign(new Error('slicer failed'), {
          stdout: longOutput,
        })
        callback(error)
      },
    )

    let thrownError: unknown
    try {
      await sliceModel(paths)
    } catch (error) {
      thrownError = error
    }

    expect(thrownError).toBeInstanceOf(Error)
    const message = (thrownError as Error).message
    expect(message).toMatch(
      /as-uploaded[\s\S]*ensure-on-bed[\s\S]*arrange[\s\S]*orient[\s\S]*full-auto-repair/,
    )
    expect(message).toContain(`${'x'.repeat(2000)}...`)
  })
})

describe('buildSlicerContext', () => {
  it('writes one unique filament config per selected colour slot', async () => {
    const gcodeId = 'slot-config-test'
    const slicingDir = path.join(process.cwd(), 'data', 'tmp', 'slicing', gcodeId)

    await fs.rm(slicingDir, { force: true, recursive: true })
    tempDirs.push(slicingDir)

    const findByID = vi.fn(async ({ collection, id }: { collection: string; id: number }) => {
      if (collection === 'gcodes') {
        return {
          id,
          filament: 1,
          process: 2,
          machine: 3,
          filamentSlots: [{ colour: 10 }, { colour: 11 }],
        }
      }

      if (collection === 'filaments') return { id, config: 101 }
      if (collection === 'processes') return { id, config: 102 }
      if (collection === 'machines') return { id, config: 103 }
      if (collection === 'filament-configs') {
        return {
          id,
          config: {
            name: 'Generic PETG',
            filament_id: 'petg',
            setting_id: 'petg-setting',
          },
        }
      }
      if (collection === 'process-configs') return { id, config: { name: 'Process' } }
      if (collection === 'machine-configs') return { id, config: { name: 'Machine' } }
      if (collection === 'colours' && id === 10) {
        return { id, swatches: [{ hexcode: '#de4343' }] }
      }
      if (collection === 'colours' && id === 11) {
        return { id, swatches: [{ hexcode: '#000000' }] }
      }

      throw new Error(`Unexpected ${collection} ${id}`)
    })

    const context = await buildSlicerContext({
      gcodeId,
      req: {
        payload: {
          findByID,
        },
      } as never,
    })

    const filamentConfigPaths = context.filamentConfigPath.split(';')
    expect(filamentConfigPaths).toHaveLength(2)

    const firstConfig = JSON.parse(await fs.readFile(filamentConfigPaths[0], 'utf-8'))
    const secondConfig = JSON.parse(await fs.readFile(filamentConfigPaths[1], 'utf-8'))

    expect(firstConfig.name).toBe('Generic PETG Slot 1')
    expect(firstConfig.filament_colour).toEqual(['#de4343'])
    expect(firstConfig.filament_self_index).toEqual(['1'])
    expect(secondConfig.name).toBe('Generic PETG Slot 2')
    expect(secondConfig.filament_colour).toEqual(['#000000'])
    expect(secondConfig.filament_self_index).toEqual(['2'])
  })

  it('writes one filament config when every slot uses the same colour', async () => {
    const gcodeId = 'same-colour-config-test'
    const slicingDir = path.join(process.cwd(), 'data', 'tmp', 'slicing', gcodeId)

    await fs.rm(slicingDir, { force: true, recursive: true })
    tempDirs.push(slicingDir)

    const findByID = vi.fn(async ({ collection, id }: { collection: string; id: number }) => {
      if (collection === 'gcodes') {
        return {
          id,
          filament: 1,
          process: 2,
          machine: 3,
          filamentSlots: [{ colour: 10 }, { colour: 10 }, { colour: 10 }],
        }
      }
      if (collection === 'filaments') return { id, config: 101 }
      if (collection === 'processes') return { id, config: 102 }
      if (collection === 'machines') return { id, config: 103 }
      if (collection === 'filament-configs') return { id, config: { name: 'Generic PLA' } }
      if (collection === 'process-configs') return { id, config: { name: 'Process' } }
      if (collection === 'machine-configs') return { id, config: { name: 'Machine' } }
      if (collection === 'colours') {
        return { id, swatches: [{ hexcode: '#de4343' }] }
      }

      throw new Error(`Unexpected ${collection} ${id}`)
    })

    const context = await buildSlicerContext({
      gcodeId,
      req: { payload: { findByID } } as never,
    })

    expect(context.filamentConfigPath).not.toContain(';')
    expect(findByID).toHaveBeenCalledTimes(8)
    expect(JSON.parse(await fs.readFile(context.filamentConfigPath, 'utf-8'))).toMatchObject({
      filament_colour: ['#de4343'],
    })
  })
})
