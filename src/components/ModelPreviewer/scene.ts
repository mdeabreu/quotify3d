import type { Group, PerspectiveCamera } from 'three'
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js'

export const resolvePreviewSlot = (paintSlot: number, meshSlot: number) => {
  const roundedPaintSlot = Math.round(paintSlot)
  return roundedPaintSlot > 0 ? roundedPaintSlot : Math.max(1, meshSlot)
}

export const visibleBounds = (THREE: typeof import('three'), object: Group) => {
  const bounds = new THREE.Box3()
  object.updateWorldMatrix(true, true)
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    const materials = Array.isArray(child.material) ? child.material : [child.material]
    if (!materials.some((material) => material.visible && material.opacity > 0)) return
    let current: import('three').Object3D | null = child
    while (current) {
      if (!current.visible) return
      if (current === object) break
      current = current.parent
    }
    const localBounds = (() => {
      if (child instanceof THREE.InstancedMesh) {
        child.computeBoundingBox()
        return child.boundingBox
      }
      child.geometry.computeBoundingBox()
      return child.geometry.boundingBox
    })()
    if (localBounds) {
      const meshBounds = localBounds.clone().applyMatrix4(child.matrixWorld)
      const values = [...meshBounds.min.toArray(), ...meshBounds.max.toArray()]
      if (values.every(Number.isFinite)) bounds.union(meshBounds)
    }
  })
  return bounds
}

export const centerModelOnPlate = (THREE: typeof import('three'), object: Group) => {
  object.position.set(0, 0, 0)
  const bounds = visibleBounds(THREE, object)
  if (bounds.isEmpty()) return false

  const center = bounds.getCenter(new THREE.Vector3())
  object.position.set(-center.x, -center.y, -bounds.min.z)
  object.updateWorldMatrix(true, true)
  return true
}

export const frameVisibleModel = (
  THREE: typeof import('three'),
  object: Group,
  camera: PerspectiveCamera,
  controls: Pick<OrbitControls, 'enableDamping' | 'target' | 'update'>,
) => {
  const bounds = visibleBounds(THREE, object)
  if (bounds.isEmpty()) return false

  const sphere = bounds.getBoundingSphere(new THREE.Sphere())
  const verticalFov = THREE.MathUtils.degToRad(camera.fov)
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect)
  const limitingFov = Math.max(0.1, Math.min(verticalFov, horizontalFov))
  const distance = (sphere.radius / Math.sin(limitingFov / 2)) * 1.15
  const direction = new THREE.Vector3(0.85, -1.15, 0.9).normalize()
  const damping = controls.enableDamping

  controls.enableDamping = false
  controls.target.copy(sphere.center)
  camera.position.copy(sphere.center).addScaledVector(direction, distance)
  camera.near = Math.max(0.01, distance - sphere.radius * 2.5)
  camera.far = Math.max(1000, distance + sphere.radius * 4)
  camera.updateProjectionMatrix()
  camera.lookAt(sphere.center)
  camera.updateMatrixWorld()
  controls.update()
  controls.enableDamping = damping
  return true
}

export const applyFaceColours = (
  THREE: typeof import('three'),
  object: Group,
  faceSlots: number[],
) => {
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

export const disposeModel = (THREE: typeof import('three'), object: Group) => {
  object.removeFromParent()
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    child.geometry.dispose()
    const material = child.material
    if (Array.isArray(material)) material.forEach((entry) => entry.dispose())
    else material.dispose()
  })
}
