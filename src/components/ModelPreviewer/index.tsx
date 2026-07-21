'use client'

import { analyzeThreeMfFiles } from '@/lib/model/threeMfAnalysis'
import { Button } from '@/components/ui/button'
import { RotateCcwIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Group, PerspectiveCamera, Scene, WebGLRenderer } from 'three'

const BUILD_PLATE_SIZE = 256

export type ModelSource = { name: string; size?: number; url: string }
type Plate = { id: string; name: string; objectIds: Set<string> }
type ThreeMfProject = {
  buffer: ArrayBuffer
  buildObjectIds: string[]
  meshSlots: number[]
  paintFaceSlots: number[]
  plates: Plate[]
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

export const resolvePreviewSlot = (paintSlot: number, meshSlot: number) => {
  const roundedPaintSlot = Math.round(paintSlot)
  return roundedPaintSlot > 0 ? roundedPaintSlot : Math.max(1, meshSlot)
}

const extensionOf = (name: string) => name.split('.').pop()?.toLowerCase()

const visibleBounds = (THREE: typeof import('three'), object: Group) => {
  const bounds = new THREE.Box3()
  object.updateWorldMatrix(true, true)
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    let current: import('three').Object3D | null = child
    while (current && current !== object) {
      if (!current.visible) return
      current = current.parent
    }
    child.geometry.computeBoundingBox()
    if (child.geometry.boundingBox) {
      bounds.union(child.geometry.boundingBox.clone().applyMatrix4(child.matrixWorld))
    }
  })
  return bounds
}

const applyFaceColours = (THREE: typeof import('three'), object: Group, faceSlots: number[]) => {
  if (!faceSlots.some(Boolean)) return
  let faceOffset = 0
  const painted = new Map<string, import('three').BufferGeometry>()

  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    const cached = painted.get(child.geometry.uuid)
    if (cached) {
      child.geometry = cached
      return
    }

    const geometry = child.geometry
    const faceCount = geometry.index
      ? geometry.index.count / 3
      : geometry.getAttribute('position').count / 3
    const slots = faceSlots.slice(faceOffset, faceOffset + faceCount)
    faceOffset += faceCount
    if (!slots.some(Boolean)) return

    const expanded = geometry.toNonIndexed()
    const vertexSlots = new Float32Array(expanded.getAttribute('position').count)
    slots.forEach((slot, index) => vertexSlots.fill(slot, index * 3, index * 3 + 3))
    expanded.setAttribute('paintSlot', new THREE.Float32BufferAttribute(vertexSlots, 1))
    painted.set(geometry.uuid, expanded)
    child.geometry = expanded
  })
}

const readThreeMfProject = async (buffer: ArrayBuffer): Promise<ThreeMfProject | null> => {
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

export const ModelPreviewer = ({
  colors = ['#808080'],
  fallbackSrc,
  model,
}: {
  colors?: string[]
  fallbackSrc: string
  model: ModelSource
}) => {
  const hostRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<Scene | null>(null)
  const rendererRef = useRef<WebGLRenderer | null>(null)
  const cameraRef = useRef<PerspectiveCamera | null>(null)
  const controlsRef = useRef<import('three/addons/controls/OrbitControls.js').OrbitControls | null>(
    null,
  )
  const modelRef = useRef<Group | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [ready, setReady] = useState(false)
  const [project, setProject] = useState<ThreeMfProject | null>(null)
  const [meshSlots, setMeshSlots] = useState<number[]>([])
  const [activePlate, setActivePlate] = useState(0)
  const paletteKey = colors.length > 0 ? colors.join('|') : '#808080'

  const resetView = useCallback(() => {
    const object = modelRef.current
    const camera = cameraRef.current
    const controls = controlsRef.current
    if (!object || !camera || !controls) return

    void import('three').then((THREE) => {
      if (modelRef.current !== object) return
      const bounds = visibleBounds(THREE, object)
      if (bounds.isEmpty()) return
      const sphere = bounds.getBoundingSphere(new THREE.Sphere())
      const verticalFov = THREE.MathUtils.degToRad(camera.fov)
      const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect)
      const limitingFov = Math.max(0.1, Math.min(verticalFov, horizontalFov))
      const distance = (sphere.radius / Math.sin(limitingFov / 2)) * 1.15
      const direction = new THREE.Vector3(0.85, -1.15, 0.9).normalize()

      controls.target.copy(sphere.center)
      camera.position.copy(sphere.center).addScaledVector(direction, distance)
      camera.near = Math.max(0.01, distance - sphere.radius * 2.5)
      camera.far = Math.max(1000, distance + sphere.radius * 4)
      camera.updateProjectionMatrix()
      camera.lookAt(sphere.center)
      controls.update()
    })
  }, [])

  const selectPlate = useCallback(
    async (index: number) => {
      const object = modelRef.current
      const plate = project?.plates[index]
      if (!object || !plate || !project) return
      const THREE = await import('three')
      object.position.set(0, 0, 0)
      object.children.forEach((child, childIndex) => {
        child.visible = plate.objectIds.has(project.buildObjectIds[childIndex])
      })
      const bounds = visibleBounds(THREE, object)
      object.position.set(
        -(bounds.min.x + bounds.max.x) / 2,
        -(bounds.min.y + bounds.max.y) / 2,
        -bounds.min.z,
      )
      setActivePlate(index)
      resetView()
    },
    [project, resetView],
  )

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let cancelled = false
    let dispose: (() => void) | undefined

    void Promise.all([import('three'), import('three/addons/controls/OrbitControls.js')]).then(
      ([THREE, { OrbitControls }]) => {
        if (cancelled) return
        const scene = new THREE.Scene()
        scene.background = new THREE.Color('#eef2f3')
        sceneRef.current = scene
        const renderer = new THREE.WebGLRenderer({ antialias: true })
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        renderer.shadowMap.enabled = true
        rendererRef.current = renderer
        host.appendChild(renderer.domElement)

        const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 10000)
        camera.up.set(0, 0, 1)
        cameraRef.current = camera
        const controls = new OrbitControls(camera, renderer.domElement)
        controlsRef.current = controls
        controls.enableDamping = true
        controls.maxPolarAngle = Math.PI * 0.49

        scene.add(new THREE.HemisphereLight('#ffffff', '#71808a', 2.4))
        const light = new THREE.DirectionalLight('#ffffff', 2.8)
        light.position.set(180, -120, 260)
        scene.add(light)
        const plate = new THREE.Mesh(
          new THREE.PlaneGeometry(BUILD_PLATE_SIZE, BUILD_PLATE_SIZE),
          new THREE.MeshStandardMaterial({ color: '#51616a', metalness: 0.1, roughness: 0.75 }),
        )
        scene.add(plate)
        const grid = new THREE.GridHelper(BUILD_PLATE_SIZE, 16, '#bcc7cc', '#71838c')
        grid.rotation.x = Math.PI / 2
        grid.position.z = 0.2
        scene.add(grid)

        const resize = () => {
          const { width, height } = host.getBoundingClientRect()
          renderer.setSize(width, height, false)
          camera.aspect = width / Math.max(height, 1)
          camera.updateProjectionMatrix()
          if (modelRef.current) resetView()
        }
        const observer = new ResizeObserver(resize)
        observer.observe(host)
        resize()

        let frame = 0
        const render = () => {
          controls.update()
          renderer.render(scene, camera)
          frame = requestAnimationFrame(render)
        }
        render()
        setReady(true)

        dispose = () => {
          cancelAnimationFrame(frame)
          observer.disconnect()
          controls.dispose()
          renderer.dispose()
          host.replaceChildren()
          sceneRef.current = null
          rendererRef.current = null
          cameraRef.current = null
          controlsRef.current = null
        }
      },
    )

    return () => {
      cancelled = true
      dispose?.()
    }
  }, [resetView])

  useEffect(() => {
    if (!ready || !sceneRef.current) return
    let cancelled = false
    const controller = new AbortController()
    setError(false)
    setLoading(true)

    void (async () => {
      try {
        const extension = extensionOf(model.name)
        if (extension !== 'stl' && extension !== '3mf') throw new Error('Unsupported preview')
        const response = await fetch(model.url, { signal: controller.signal })
        if (!response.ok) throw new Error('Model unavailable')
        const buffer = await response.arrayBuffer()
        const nextProject = extension === '3mf' ? await readThreeMfProject(buffer) : null
        const THREE = await import('three')
        if (cancelled) return

        let object: Group
        if (extension === 'stl') {
          const { STLLoader } = await import('three/addons/loaders/STLLoader.js')
          const geometry = new STLLoader().parse(buffer)
          geometry.computeVertexNormals()
          object = new THREE.Group()
          object.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: '#808080' })))
        } else {
          const { ThreeMFLoader } = await import('three/addons/loaders/3MFLoader.js')
          object = new ThreeMFLoader().parse(nextProject?.buffer ?? buffer)
          if (nextProject) applyFaceColours(THREE, object, nextProject.paintFaceSlots)
        }

        const firstPlate = nextProject?.plates[0]
        if (firstPlate && nextProject) {
          object.children.forEach((child, index) => {
            child.visible = firstPlate.objectIds.has(nextProject.buildObjectIds[index])
          })
        }

        const bounds = visibleBounds(THREE, object)
        object.position.set(
          -(bounds.min.x + bounds.max.x) / 2,
          -(bounds.min.y + bounds.max.y) / 2,
          -bounds.min.z,
        )
        const previous = modelRef.current
        sceneRef.current?.add(object)
        modelRef.current = object
        setProject(nextProject)
        setMeshSlots(nextProject?.meshSlots ?? [1])
        setActivePlate(0)
        resetView()
        if (previous) {
          previous.removeFromParent()
          previous.traverse((child) => {
            if (!(child instanceof THREE.Mesh)) return
            child.geometry.dispose()
            const material = child.material
            if (Array.isArray(material)) material.forEach((entry) => entry.dispose())
            else material.dispose()
          })
        }
      } catch (reason) {
        if (!cancelled && !(reason instanceof DOMException && reason.name === 'AbortError')) {
          setError(true)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [model.name, model.url, ready, resetView])

  useEffect(() => {
    const object = modelRef.current
    if (!object) return
    let cancelled = false
    const palette = paletteKey.split('|')
    void import('three').then((THREE) => {
      if (cancelled || modelRef.current !== object) return
      let meshIndex = 0
      object.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return
        const paintSlots = child.geometry.getAttribute('paintSlot')
        const slot = meshSlots[meshIndex++] ?? 1
        if (paintSlots) {
          const values = new Float32Array(paintSlots.count * 3)
          const color = new THREE.Color()
          for (let index = 0; index < paintSlots.count; index++) {
            const previewSlot = resolvePreviewSlot(paintSlots.getX(index), slot)
            color.set(palette[previewSlot - 1] ?? palette[slot - 1] ?? palette[0] ?? '#808080')
            values.set([color.r, color.g, color.b], index * 3)
          }
          child.geometry.setAttribute('color', new THREE.Float32BufferAttribute(values, 3))
          const previous = child.material
          child.material = new THREE.MeshStandardMaterial({ roughness: 0.46, vertexColors: true })
          if (Array.isArray(previous)) previous.forEach((entry) => entry.dispose())
          else previous.dispose()
        } else {
          const previous = child.material
          child.material = new THREE.MeshStandardMaterial({
            color: palette[slot - 1] ?? palette[0] ?? '#808080',
            roughness: 0.46,
          })
          if (Array.isArray(previous)) previous.forEach((entry) => entry.dispose())
          else previous.dispose()
        }
      })
    })
    return () => {
      cancelled = true
    }
  }, [meshSlots, paletteKey])

  useEffect(
    () => () => {
      const object = modelRef.current
      if (!object) return
      void import('three').then((THREE) => {
        object.traverse((child) => {
          if (!(child instanceof THREE.Mesh)) return
          child.geometry.dispose()
          const material = child.material
          if (Array.isArray(material)) material.forEach((entry) => entry.dispose())
          else material.dispose()
        })
      })
    },
    [],
  )

  return (
    <div className="relative size-full min-h-72 overflow-hidden bg-[#eef2f3]">
      <div className="absolute top-3 right-3 z-10 flex gap-2">
        {project && project.plates.length > 1
          ? project.plates.map((plate, index) => (
              <Button
                aria-pressed={activePlate === index}
                key={plate.id}
                onClick={() => void selectPlate(index)}
                size="sm"
                type="button"
                variant={activePlate === index ? 'default' : 'outline'}
              >
                {plate.name}
              </Button>
            ))
          : null}
        <Button onClick={resetView} size="icon" title="Reset view" type="button" variant="outline">
          <RotateCcwIcon className="size-4" />
          <span className="sr-only">Reset view</span>
        </Button>
      </div>
      <div className="absolute inset-0" ref={hostRef} />
      {error ? (
        <img
          alt="Model preview unavailable"
          className="absolute inset-0 size-full object-cover"
          src={fallbackSrc}
        />
      ) : null}
      {loading ? (
        <div className="absolute inset-0 flex items-center justify-center bg-background/70 text-sm">
          Preparing preview...
        </div>
      ) : null}
    </div>
  )
}
