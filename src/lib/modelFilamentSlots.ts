import { readFile } from 'fs/promises'
import path from 'path'

import { Unzip, UnzipInflate } from 'fflate'

export {
  analyze3MFFilamentSlotCount,
  decodePaintStates,
  extractExtruderSlots,
  extractPaintFaceSlots,
  get3MFFilamentSlotCount,
  read3MFProjectSettings,
  representativePaintSlot,
} from '@/lib/model/threeMfAnalysis'
import { analyze3MFFilamentSlotCount } from '@/lib/model/threeMfAnalysis'

const DEFAULT_ARCHIVE_LIMITS = {
  compressedBytes: 128 * 1024 * 1024,
  entries: 2048,
  uncompressedBytes: 256 * 1024 * 1024,
} as const

type ModelArchiveLimits = {
  compressedBytes: number
  entries: number
  uncompressedBytes: number
}

export class ModelArchiveLimitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ModelArchiveLimitError'
  }
}

const joinChunks = (chunks: Uint8Array[], size: number) => {
  const output = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    output.set(chunk, offset)
    offset += chunk.length
  }
  return output
}

export const unzipModelArchive = (
  data: Uint8Array,
  limits: ModelArchiveLimits = DEFAULT_ARCHIVE_LIMITS,
) => {
  if (data.byteLength > limits.compressedBytes) {
    throw new ModelArchiveLimitError('The compressed 3MF file is too large.')
  }

  const files: Record<string, Uint8Array> = {}
  let entryCount = 0
  let uncompressedBytes = 0
  const unzip = new Unzip((file) => {
    entryCount += 1
    if (entryCount > limits.entries) {
      throw new ModelArchiveLimitError('The 3MF file contains too many archive entries.')
    }

    if (
      typeof file.originalSize === 'number' &&
      uncompressedBytes + file.originalSize > limits.uncompressedBytes
    ) {
      throw new ModelArchiveLimitError('The expanded 3MF file is too large.')
    }

    const chunks: Uint8Array[] = []
    let entryBytes = 0
    file.ondata = (error, chunk, final) => {
      if (error) throw error

      entryBytes += chunk.length
      uncompressedBytes += chunk.length
      if (uncompressedBytes > limits.uncompressedBytes) {
        file.terminate()
        throw new ModelArchiveLimitError('The expanded 3MF file is too large.')
      }

      chunks.push(chunk)
      if (final) files[file.name] = joinChunks(chunks, entryBytes)
    }
    file.start()
  })
  unzip.register(UnzipInflate)
  unzip.push(data, true)
  return files
}

export const analyzeModelFilamentSlotCount = (filename: string, data: Uint8Array): number => {
  if (path.extname(filename).toLowerCase() !== '.3mf') return 1

  return analyze3MFFilamentSlotCount(unzipModelArchive(data))
}

export const detectModelFilamentSlotCount = async (modelPath: string): Promise<number> => {
  if (path.extname(modelPath).toLowerCase() !== '.3mf') return 1

  try {
    return analyzeModelFilamentSlotCount(modelPath, await readFile(modelPath))
  } catch {
    return 1
  }
}
