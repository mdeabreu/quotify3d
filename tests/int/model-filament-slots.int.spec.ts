import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'

import { zipSync } from 'fflate'

import {
  analyzeModelFilamentSlotCount,
  analyze3MFFilamentSlotCount,
  decodePaintStates,
  detectModelFilamentSlotCount,
} from '@/lib/modelFilamentSlots'

const encoder = new TextEncoder()
const tempDirs: string[] = []

const asBytes = (contents: string) => encoder.encode(contents)

const createThreeMf = async (files: Record<string, string>) => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'quotify3d-slots-'))
  tempDirs.push(tempDir)

  const modelPath = path.join(tempDir, 'model.3mf')
  await fs.writeFile(
    modelPath,
    zipSync(
      Object.fromEntries(
        Object.entries(files).map(([filePath, contents]) => [filePath, asBytes(contents)]),
      ),
    ),
  )

  return modelPath
}

afterEach(async () => {
  for (const tempDir of tempDirs.splice(0)) {
    await fs.rm(tempDir, { force: true, recursive: true })
  }
})

describe('detectModelFilamentSlotCount', () => {
  it('defaults non-3MF models to one slot', async () => {
    await expect(detectModelFilamentSlotCount('/models/part.stl')).resolves.toBe(1)
  })

  it('detects the largest filament metadata array in a 3MF project', async () => {
    const modelPath = await createThreeMf({
      '3D/3dmodel.model': '<model><resources /></model>',
      'Metadata/project_settings.config': JSON.stringify({
        filament_colour: ['#ff0000', '#000000', '#ffffff'],
        filament_type: ['PLA'],
      }),
    })

    await expect(detectModelFilamentSlotCount(modelPath)).resolves.toBe(3)
  })

  it('detects Bambu/Orca part extruders in model settings', async () => {
    const modelPath = await createThreeMf({
      '3D/3dmodel.model': '<model><resources /></model>',
      'Metadata/model_settings.config': `
        <config>
          <part><metadata key="extruder" value="1" /></part>
          <part><metadata key="extruder" value="4" /></part>
        </config>
      `,
    })

    await expect(detectModelFilamentSlotCount(modelPath)).resolves.toBe(4)
  })

  it('detects Prusa paint streams in external object files', async () => {
    const modelPath = await createThreeMf({
      '3D/3dmodel.model': '<model><resources /></model>',
      '3D/Objects/object_1.model': `
        <model>
          <mesh>
            <triangles>
              <triangle v1="0" v2="1" v3="2" paint_color="1c" />
            </triangles>
          </mesh>
        </model>
      `,
    })

    await expect(detectModelFilamentSlotCount(modelPath)).resolves.toBe(4)
  })

  it('detects the three painted slots used by PrusaSlicer segmentation data', () => {
    const model = `
      <model xmlns:slic3rpe="http://schemas.slic3r.org/3mf/2017/06">
        <triangle slic3rpe:mmu_segmentation="4" />
        <triangle slic3rpe:mmu_segmentation="8" />
        <triangle slic3rpe:mmu_segmentation="0c" />
      </model>
    `

    expect(
      analyzeModelFilamentSlotCount(
        'painted.3mf',
        zipSync({ '3D/3dmodel.model': asBytes(model) }),
      ),
    ).toBe(3)
  })

  it('handles large painted models without expanding every face onto the call stack', () => {
    const triangles = Array.from(
      { length: 20_000 },
      (_, index) =>
        `<triangle slic3rpe:mmu_segmentation="${['4', '8', '0c'][index % 3]}" />`,
    ).join('')

    expect(
      analyze3MFFilamentSlotCount({
        '3D/3dmodel.model': asBytes(`<model>${triangles}</model>`),
      }),
    ).toBe(3)
  })

  it('uses the max slot count across every supported 3MF source', () => {
    expect(
      analyze3MFFilamentSlotCount({
        '3D/3dmodel.model': asBytes('<model><resources /></model>'),
        'Metadata/project_settings.config': asBytes(
          JSON.stringify({ filament_colour: ['#ff0000', '#000000'] }),
        ),
        'Metadata/model_settings.config': asBytes(
          '<config><part><metadata key="extruder" value="3" /></part></config>',
        ),
        '3D/Objects/object_1.model': asBytes(
          '<model><triangle v1="0" v2="1" v3="2" paint_color="1c" /></model>',
        ),
      }),
    ).toBe(4)
  })

  it('falls back to one slot when a 3MF cannot be read', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'quotify3d-slots-'))
    tempDirs.push(tempDir)

    const modelPath = path.join(tempDir, 'broken.3mf')
    await fs.writeFile(modelPath, 'not a zip archive')

    await expect(detectModelFilamentSlotCount(modelPath)).resolves.toBe(1)
  })
})

describe('decodePaintStates', () => {
  it('decodes extended paint states', () => {
    expect(decodePaintStates('1c')).toEqual([4])
  })
})
