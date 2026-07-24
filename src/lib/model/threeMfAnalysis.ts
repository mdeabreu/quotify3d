type JSONObject = Record<string, unknown>
export type ThreeMfFiles = Record<string, Uint8Array>

const PROJECT_SETTINGS = 'Metadata/project_settings.config'
const MODEL_SETTINGS = 'Metadata/model_settings.config'
const ROOT_MODEL = '3D/3dmodel.model'
const SLOT_FIELDS = [
  'filament_colour',
  'filament_multi_colour',
  'extruder_colour',
  'filament_type',
  'filament_settings_id',
] as const
const decoder = new TextDecoder()

const isObject = (value: unknown): value is JSONObject =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value))

const normalizeStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string')
  return typeof value === 'string' && value ? [value] : []
}

const readAttributes = (source: string) => {
  const attributes = new Map<string, string>()
  for (const match of source.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)) {
    attributes.set(match[1], match[2])
  }
  return attributes
}

const parseExtruderSlot = (source: string): number | undefined => {
  for (const metadata of source.matchAll(/<metadata\b([^>]*)\/?\s*>/g)) {
    const attributes = readAttributes(metadata[1])
    if (attributes.get('key') !== 'extruder') continue

    const slot = Number(attributes.get('value'))
    return Number.isInteger(slot) && slot > 0 ? slot : undefined
  }

  return undefined
}

export const get3MFFilamentSlotCount = (settings: JSONObject | undefined): number => {
  if (!settings) return 1
  return Math.max(
    1,
    ...SLOT_FIELDS.map((field) => normalizeStringArray(settings[field]).length),
  )
}

export const read3MFProjectSettings = (files: ThreeMfFiles): JSONObject | undefined => {
  const contents = files[PROJECT_SETTINGS]
  if (!contents) return undefined
  const parsed = JSON.parse(decoder.decode(contents))
  return isObject(parsed) ? parsed : undefined
}

export const extractExtruderSlotAssignments = (settingsXml: string): Map<string, number[]> => {
  const assignments = new Map<string, number[]>()
  const partPattern = /<part\b([^>]*?)\/\s*>|<part\b([^>]*)>([\s\S]*?)<\/part\s*>/g

  for (const object of settingsXml.matchAll(/<object\b([^>]*)>([\s\S]*?)<\/object\s*>/g)) {
    const objectId = readAttributes(object[1]).get('id')
    if (!objectId) continue

    const objectContents = object[2]
    const objectSlot = parseExtruderSlot(objectContents.replace(partPattern, ''))
    const partSlots = Array.from(objectContents.matchAll(partPattern), (part) => {
      return parseExtruderSlot(part[3] ?? '') ?? objectSlot ?? 1
    })

    assignments.set(objectId, partSlots.length > 0 ? partSlots : [objectSlot ?? 1])
  }

  return assignments
}

export const extractExtruderSlots = (settingsXml: string): number[] =>
  Array.from(extractExtruderSlotAssignments(settingsXml).values()).flat()

export const decodePaintStates = (value: string): number[] => {
  const bits: number[] = []
  for (let index = value.length - 1; index >= 0; index--) {
    const nibble = Number.parseInt(value[index], 16)
    if (Number.isNaN(nibble)) return []
    for (let bit = 0; bit < 4; bit++) bits.push((nibble >> bit) & 1)
  }

  let position = 0
  const read = (length: number) => {
    if (position + length > bits.length) throw new Error('Paint stream ended unexpectedly')
    let result = 0
    for (let bit = 0; bit < length; bit++) result |= bits[position++] << bit
    return result
  }

  try {
    const states: number[] = []
    const pendingNodes = [1]
    while (pendingNodes.length) {
      pendingNodes.pop()
      const splitSides = read(2)
      if (splitSides) {
        read(2)
        for (let child = 0; child < splitSides + 1; child++) pendingNodes.push(1)
        continue
      }
      let state = read(2)
      if (state === 3) {
        let extension = 0
        do {
          extension = read(4)
          state += extension
        } while (extension === 15)
      }
      states.push(state)
    }
    return position === bits.length ? states : []
  } catch {
    return []
  }
}

export const representativePaintSlot = (value: string): number => {
  const states = decodePaintStates(value).filter((state) => state > 0)
  if (!states.length) return 0
  const counts = new Map<number, number>()
  states.forEach((state) => counts.set(state, (counts.get(state) ?? 0) + 1))
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0][0]
}

export const extractPaintFaceSlots = (modelXml: string): number[] => {
  const slots: number[] = []
  for (const triangle of modelXml.matchAll(/<triangle\b([^>]*)\/?\s*>/g)) {
    const attributes = readAttributes(triangle[1])
    const paint = attributes.get('slic3rpe:mmu_segmentation') ?? attributes.get('paint_color')
    slots.push(paint ? representativePaintSlot(paint) : 0)
  }
  return slots
}

export const analyzeThreeMfFiles = (files: ThreeMfFiles) => {
  if (!files[ROOT_MODEL]) throw new Error('This 3MF file does not contain a printable model.')

  const projectSlotCount = get3MFFilamentSlotCount(read3MFProjectSettings(files))
  const settings = files[MODEL_SETTINGS]
  const extruderSlotAssignments = settings
    ? extractExtruderSlotAssignments(decoder.decode(settings))
    : new Map<string, number[]>()
  const meshSlots = Array.from(extruderSlotAssignments.values()).flat()
  const paintFaceSlots = Object.entries(files)
    .filter(
      ([filePath]) =>
        filePath === ROOT_MODEL ||
        (filePath.startsWith('3D/Objects/') && filePath.endsWith('.model')),
    )
    .sort(([left], [right]) =>
      left === ROOT_MODEL ? -1 : right === ROOT_MODEL ? 1 : left.localeCompare(right),
    )
    .flatMap(([, model]) => extractPaintFaceSlots(decoder.decode(model)))

  const slotCount = [...meshSlots, ...paintFaceSlots].reduce(
    (maximum, slot) => Math.max(maximum, slot),
    projectSlotCount,
  )
  return { extruderSlotAssignments, meshSlots, paintFaceSlots, slotCount }
}

export const analyze3MFFilamentSlotCount = (files: ThreeMfFiles): number =>
  analyzeThreeMfFiles(files).slotCount
