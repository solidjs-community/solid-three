import { createRoot } from "solid-js"
import * as THREE from "three"
import { describe, expect, it, vi } from "vitest"
import { createXR } from "../../src/create-xr.tsx"
import { meta } from "../../src/utils.ts"

// three's WebXRManager is an EventDispatcher ({ type } events). Mirror the slice
// createXR + XRPointerManager use, plus getController returning a real Object3D
// (which is itself an EventDispatcher and carries a matrixWorld for the ray).
function makeFakeXR(getController: (index: number) => THREE.Object3D) {
  const listeners: Record<string, Set<(event: { type: string }) => void>> = {}
  return {
    enabled: false,
    setSession: vi.fn(async () => {}),
    addEventListener: (type: string, listener: (event: { type: string }) => void) => {
      ;(listeners[type] ??= new Set()).add(listener)
    },
    removeEventListener: (type: string, listener: (event: { type: string }) => void) => {
      listeners[type]?.delete(listener)
    },
    dispatch: (type: string) => listeners[type]?.forEach(listener => listener({ type })),
    getController: vi.fn(getController),
  }
}

function renderXR() {
  let xr!: ReturnType<typeof createXR>
  const dispose = createRoot(d => {
    xr = createXR()
    return d
  })
  return { xr, dispose }
}

describe("XR controller pointers", () => {
  it("select drives onPointerDown/onPointerUp/onClick on the targeted mesh, and tears down on sessionend", () => {
    const down = vi.fn()
    const up = vi.fn()
    const click = vi.fn()
    // A plane (single front-facing intersection) keeps the per-intersection
    // down/up dispatch deterministic — a box yields two hits (front+back).
    const mesh = meta(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial()), {
      props: { onPointerDown: down, onPointerUp: up, onClick: click },
    }) as unknown as THREE.Object3D
    mesh.updateMatrixWorld()

    // Controller at +z, default orientation looks down -z toward the mesh at origin.
    const controller = new THREE.Object3D()
    controller.position.set(0, 0, 5)
    controller.updateMatrixWorld()
    const empty = new THREE.Object3D()

    const xrManager = makeFakeXR(index => (index === 0 ? controller : empty))
    const context = {
      gl: { xr: xrManager, setAnimationLoop: vi.fn() },
      render: vi.fn(),
      eventRegistry: [mesh],
      props: {},
    } as any

    const { xr, dispose } = renderXR()
    xr.connect(context)
    xrManager.dispatch("sessionstart") // creates the XRPointerManager

    controller.dispatchEvent({ type: "selectstart" } as any)
    expect(down).toHaveBeenCalled() // bubbled per intersection (count is a raycast detail)

    controller.dispatchEvent({ type: "selectend" } as any)
    expect(up).toHaveBeenCalled()
    expect(click).toHaveBeenCalledTimes(1) // synthesized from select-down/up; deduped via visited

    // sessionend disconnects the controller pointers — further select is inert.
    const downCallsBefore = down.mock.calls.length
    xrManager.dispatch("sessionend")
    controller.dispatchEvent({ type: "selectstart" } as any)
    expect(down.mock.calls.length).toBe(downCallsBefore)

    dispose()
  })
})
