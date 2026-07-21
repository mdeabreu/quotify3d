import { readFile } from 'fs/promises'
import path from 'path'

import { unzipSync } from 'fflate'

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

export const analyzeModelFilamentSlotCount = (filename: string, data: Uint8Array): number => {
  if (path.extname(filename).toLowerCase() !== '.3mf') return 1

  return analyze3MFFilamentSlotCount(unzipSync(data))
}

export const detectModelFilamentSlotCount = async (modelPath: string): Promise<number> => {
  if (path.extname(modelPath).toLowerCase() !== '.3mf') return 1

  try {
    return analyzeModelFilamentSlotCount(modelPath, await readFile(modelPath))
  } catch {
    return 1
  }
}
