import { describe, expect, it } from "vitest"
import {
  BoxGeometry,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  Vector2,
} from "three"
import { CenterRaycaster, ControllerRaycaster, CursorRaycaster } from "../../src/raycasters.tsx"
import { meta } from "../../src/utils.ts"

function ctx(camera: PerspectiveCamera) {
  return { camera, bounds: { width: 200, height: 100 } } as any
}
// A box carrying solid-three meta (only meta'd objects are raycast, like the real engine).
function box(props: Record<string, any> = {}) {
  const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial())
  mesh.updateMatrixWorld()
  return meta(mesh, { props }) as any as Mesh
}
function camera() {
  const c = new PerspectiveCamera(75, 2, 0.1, 1000)
  c.position.set(0, 0, 5)
  c.updateMatrixWorld()
  return c
}

describe("EventRaycaster.cast", () => {
  it("CursorRaycaster casts from the set cursor and hits", () => {
    const mesh = box()
    const rc = new CursorRaycaster()
    rc.setCursor(new Vector2(0, 0))
    expect(rc.cast([mesh], ctx(camera()))[0]?.object).toBe(mesh)
  })

  it("CursorRaycaster misses when the cursor is off-axis", () => {
    const mesh = box()
    const rc = new CursorRaycaster()
    rc.setCursor(new Vector2(0.99, 0.99))
    expect(rc.cast([mesh], ctx(camera()))).toHaveLength(0)
  })

  it("CenterRaycaster ignores setCursor and casts from centre", () => {
    const mesh = box()
    const rc = new CenterRaycaster()
    rc.setCursor(new Vector2(0.99, 0.99)) // ignored — centre is fixed
    expect(rc.cast([mesh], ctx(camera()))[0]?.object).toBe(mesh)
  })

  it("ControllerRaycaster casts from its space's matrixWorld", () => {
    const mesh = box()
    const space = new Object3D()
    space.position.set(0, 0, 1) // at +z, default orientation looks down -z toward origin
    space.updateMatrixWorld()
    const rc = new ControllerRaycaster(space)
    expect(rc.cast([mesh], ctx(camera()))[0]?.object).toBe(mesh)
  })

  it("honors raycastable === false (object opts out of hit-testing)", () => {
    const mesh = box({ raycastable: false })
    const rc = new CursorRaycaster()
    rc.setCursor(new Vector2(0, 0))
    expect(rc.cast([mesh], ctx(camera()))).toHaveLength(0)
  })
})

describe("aim()", () => {
  it("positions the ray from the camera + cursor without casting the registry", () => {
    const raycaster = new CursorRaycaster()
    const camera = new PerspectiveCamera()
    camera.position.set(0, 0, 5)
    camera.updateMatrixWorld()
    const context = { camera } as any

    raycaster.setCursor(new Vector2(0, 0)) // dead centre
    raycaster.aim(context)

    // Ray now originates at the camera and points toward -z (into the scene).
    expect(raycaster.ray.origin.z).toBeCloseTo(5)
    expect(raycaster.ray.direction.z).toBeLessThan(0)
  })
})
