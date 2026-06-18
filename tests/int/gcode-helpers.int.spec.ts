import fs from 'fs/promises'
import fsSync from 'fs'
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

import { sliceModel } from '@/jobs/workflows/helpers/gcodeHelpers'

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
