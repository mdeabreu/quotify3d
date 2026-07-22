'use client'

import { Button } from '@/components/ui/button'
import { RotateCcwIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Group, PerspectiveCamera, Scene } from 'three'
import { readThreeMfProject, type ThreeMfProject } from './archive'
import {
  applyFaceColours,
  centerModelOnPlate,
  disposeModel,
  frameVisibleModel,
  resolvePreviewSlot,
} from './scene'

export { expandSingleComponentProjects } from './archive'
export { resolvePreviewSlot } from './scene'

const BUILD_PLATE_SIZE = 256

export type ModelSource = { name: string; size?: number; url: string }
const extensionOf = (name: string) => name.split('.').pop()?.toLowerCase()

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
  const cameraRef = useRef<PerspectiveCamera | null>(null)
  const controlsRef = useRef<import('three/addons/controls/OrbitControls.js').OrbitControls | null>(
    null,
  )
  const modelRef = useRef<Group | null>(null)
  const contentRef = useRef<Group | null>(null)
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
      frameVisibleModel(THREE, object, camera, controls)
    })
  }, [])

  const selectPlate = useCallback(
    async (index: number) => {
      const object = modelRef.current
      const content = contentRef.current
      const plate = project?.plates[index]
      if (!object || !content || !plate || !project) return
      const THREE = await import('three')
      content.children.forEach((child, childIndex) => {
        child.visible = plate.objectIds.has(project.buildObjectIds[childIndex])
      })
      centerModelOnPlate(THREE, object)
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
          renderer.setSize(width, height)
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

        let content: Group
        if (extension === 'stl') {
          const { STLLoader } = await import('three/addons/loaders/STLLoader.js')
          const geometry = new STLLoader().parse(buffer)
          geometry.computeVertexNormals()
          content = new THREE.Group()
          content.add(
            new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: '#808080' })),
          )
        } else {
          const { ThreeMFLoader } = await import('three/addons/loaders/3MFLoader.js')
          content = new ThreeMFLoader().parse(nextProject?.buffer ?? buffer)
          if (nextProject) applyFaceColours(THREE, content, nextProject.paintFaceSlots)
        }

        const firstPlate = nextProject?.plates[0]
        if (firstPlate && nextProject) {
          content.children.forEach((child, index) => {
            child.visible = firstPlate.objectIds.has(nextProject.buildObjectIds[index])
          })
        }

        const object = new THREE.Group()
        object.add(content)
        if (!centerModelOnPlate(THREE, object)) throw new Error('Model has no visible geometry')
        const previous = modelRef.current
        sceneRef.current?.add(object)
        modelRef.current = object
        contentRef.current = content
        setProject(nextProject)
        setMeshSlots(nextProject?.meshSlots ?? [1])
        setActivePlate(0)
        resetView()
        if (previous) {
          disposeModel(THREE, previous)
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
        disposeModel(THREE, object)
        contentRef.current = null
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
        // The fallback URL is admin-configurable and may not use a Next.js image host.
        // eslint-disable-next-line @next/next/no-img-element
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
