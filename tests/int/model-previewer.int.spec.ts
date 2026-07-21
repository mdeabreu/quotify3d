import { describe, expect, it } from 'vitest'

import { expandSingleComponentProjects, resolvePreviewSlot } from '@/components/ModelPreviewer'

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
