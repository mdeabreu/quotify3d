import { describe, expect, it } from 'vitest'
import * as THREE from 'three'

import { expandSingleComponentProjects, resolvePreviewSlot } from '@/components/ModelPreviewer'
import { resolveBuildExtruderSlots } from '@/components/ModelPreviewer/archive'
import { centerModelOnPlate, visibleBounds } from '@/components/ModelPreviewer/scene'

const parseXml = (contents: string) => new DOMParser().parseFromString(contents, 'application/xml')

const settings = parseXml(`
  <config>
    <object id="3">
      <part id="1" />
      <part id="2" />
      <part id="2" />
    </object>
  </config>
`)

describe('expandSingleComponentProjects', () => {
  it('preserves an existing multi-component assembly and its transforms', () => {
    const model = parseXml(`
      <model xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06">
        <resources>
          <object id="3">
            <components>
              <component p:path="/3D/Objects/object.model" objectid="1" transform="body" />
              <component p:path="/3D/Objects/object.model" objectid="2" transform="left-eye" />
              <component p:path="/3D/Objects/object.model" objectid="2" transform="right-eye" />
            </components>
          </object>
        </resources>
      </model>
    `)

    expect(expandSingleComponentProjects(model, settings)).toBe(false)
    expect(
      Array.from(model.querySelectorAll('component')).map((component) => ({
        id: component.getAttribute('objectid'),
        transform: component.getAttribute('transform'),
      })),
    ).toEqual([
      { id: '1', transform: 'body' },
      { id: '2', transform: 'left-eye' },
      { id: '2', transform: 'right-eye' },
    ])
  })

  it('still expands a single path-backed proxy into its project parts', () => {
    const model = parseXml(`
      <model xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06">
        <resources>
          <object id="3">
            <components>
              <component p:path="/3D/Objects/object.model" objectid="1" transform="source" />
            </components>
          </object>
        </resources>
      </model>
    `)

    expect(expandSingleComponentProjects(model, settings)).toBe(true)
    expect(
      Array.from(model.querySelectorAll('component')).map((component) => ({
        id: component.getAttribute('objectid'),
        transform: component.getAttribute('transform'),
      })),
    ).toEqual([
      { id: '1', transform: 'source' },
      { id: '2', transform: 'source' },
      { id: '2', transform: 'source' },
    ])
  })
})

describe('resolvePreviewSlot', () => {
  it('uses explicit face paint when present', () => {
    expect(resolvePreviewSlot(3, 2)).toBe(3)
  })

  it('falls back to the containing mesh slot for unpainted faces', () => {
    expect(resolvePreviewSlot(0, 2)).toBe(2)
  })
})

describe('resolveBuildExtruderSlots', () => {
  it('aligns settings to build order and repeats referenced objects', () => {
    const assignments = new Map([
      ['10', [2, 4]],
      ['20', [3]],
    ])

    expect(resolveBuildExtruderSlots(['20', '10', '20'], assignments)).toEqual([3, 2, 4, 3])
  })

  it('falls back to slot one for build objects missing from settings', () => {
    expect(resolveBuildExtruderSlots(['10', 'missing'], new Map([['10', [2]]]))).toEqual([2, 1])
  })
})

describe('preview framing', () => {
  it('centres nested translated content on the build plate', () => {
    const wrapper = new THREE.Group()
    const archiveRoot = new THREE.Group()
    archiveRoot.position.set(80, -45, 12)
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(20, 30, 40))
    mesh.position.set(15, 25, 20)
    archiveRoot.add(mesh)
    wrapper.add(archiveRoot)

    expect(centerModelOnPlate(THREE, wrapper)).toBe(true)

    const bounds = visibleBounds(THREE, wrapper)
    const center = bounds.getCenter(new THREE.Vector3())
    expect(center.x).toBeCloseTo(0)
    expect(center.y).toBeCloseTo(0)
    expect(bounds.min.z).toBeCloseTo(0)
  })

  it('ignores invisible geometry when calculating preview bounds', () => {
    const model = new THREE.Group()
    model.add(new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10)))
    const hidden = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10))
    hidden.position.set(1000, 1000, 1000)
    hidden.visible = false
    model.add(hidden)

    const bounds = visibleBounds(THREE, model)

    expect(bounds.max.x).toBeCloseTo(5)
    expect(bounds.max.y).toBeCloseTo(5)
    expect(bounds.max.z).toBeCloseTo(5)
  })

  it('includes instance transforms in preview bounds', () => {
    const model = new THREE.Group()
    const mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(10, 10, 10),
      new THREE.MeshBasicMaterial(),
      2,
    )
    mesh.setMatrixAt(0, new THREE.Matrix4().makeTranslation(50, 0, 0))
    mesh.setMatrixAt(1, new THREE.Matrix4().makeTranslation(100, 0, 0))
    model.add(mesh)

    const bounds = visibleBounds(THREE, model)

    expect(bounds.min.x).toBeCloseTo(45)
    expect(bounds.max.x).toBeCloseTo(105)
  })
})
