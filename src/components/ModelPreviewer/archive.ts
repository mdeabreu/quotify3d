import { analyzeThreeMfFiles } from '@/lib/model/threeMfAnalysis'

export type PreviewPlate = { id: string; name: string; objectIds: Set<string> }
export type ThreeMfProject = {
  buffer: ArrayBuffer
  buildObjectIds: string[]
  meshSlots: number[]
  paintFaceSlots: number[]
  plates: PreviewPlate[]
}

export const expandSingleComponentProjects = (modelXml: Document, settingsXml: Document | null) => {
  let expanded = false
  Array.from(settingsXml?.querySelectorAll('config > object') ?? []).forEach((settingsObject) => {
    const sourceObjectId = settingsObject.getAttribute('id')
    const parts = Array.from(settingsObject.querySelectorAll(':scope > part'))
    const target = Array.from(modelXml.querySelectorAll('resources > object')).find(
      (object) => object.getAttribute('id') === sourceObjectId,
    )
    const components = target?.querySelector(':scope > components')
    const existing = Array.from(components?.querySelectorAll(':scope > component') ?? [])
    const source = existing.find(
      (component) => component.hasAttribute('p:path') || component.hasAttribute('path'),
    )
    if (!source || !components || existing.length !== 1 || parts.length < 2) return

    components.replaceChildren(
      ...parts.map((part) => {
        const component = source.cloneNode(true) as Element
        component.setAttribute('objectid', part.getAttribute('id') ?? '')
        return component
      }),
    )
    expanded = true
  })
  return expanded
}

export const readThreeMfProject = async (buffer: ArrayBuffer): Promise<ThreeMfProject | null> => {
  const { unzipSync, zipSync } = await import('fflate')
  const files = unzipSync(new Uint8Array(buffer))
  const analysis = analyzeThreeMfFiles(files)
  const decoder = new TextDecoder()
  const model = files['3D/3dmodel.model']
  const settings = files['Metadata/model_settings.config']
  if (!model) return null

  const modelXml = new DOMParser().parseFromString(decoder.decode(model), 'application/xml')
  const settingsXml = settings
    ? new DOMParser().parseFromString(decoder.decode(settings), 'application/xml')
    : null
  const buildObjectIds = Array.from(modelXml.querySelectorAll('build > item')).map(
    (item) => item.getAttribute('objectid') ?? '',
  )
  const plates = Array.from(settingsXml?.querySelectorAll('plate') ?? [])
    .map((plate, index) => {
      const metadata = Array.from(plate.querySelectorAll(':scope > metadata'))
      const value = (key: string) =>
        metadata.find((entry) => entry.getAttribute('key') === key)?.getAttribute('value')
      return {
        id: value('plater_id') ?? String(index + 1),
        name: value('plater_name') ?? `Plate ${index + 1}`,
        objectIds: new Set(
          Array.from(plate.querySelectorAll('model_instance metadata[key="object_id"]')).map(
            (item) => item.getAttribute('value') ?? '',
          ),
        ),
      }
    })
    .filter((plate) => plate.objectIds.size > 0)

  const expanded = expandSingleComponentProjects(modelXml, settingsXml)
  const output = expanded
    ? zipSync({
        ...files,
        '3D/3dmodel.model': new TextEncoder().encode(
          new XMLSerializer().serializeToString(modelXml),
        ),
      }).buffer
    : buffer

  return {
    buffer: output as ArrayBuffer,
    buildObjectIds,
    meshSlots: analysis.meshSlots,
    paintFaceSlots: analysis.paintFaceSlots,
    plates,
  }
}
