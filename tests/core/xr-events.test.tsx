import * as THREE from "three"
import { assertType, describe, expect, it, vi } from "vitest"
import { createT } from "../../src/create-t.tsx"
import { test as renderThree } from "../../src/testing/index.tsx"
import { XRControllerSource, type XRThreeEvent, xrEvents } from "../../src/xr/events.ts"
import { meta } from "../../src/utils.ts"

function makeFakeXR(getController: (index: number) => THREE.Object3D) {
  const listeners: Record<string, Set<(event: { type: string }) => void>> = {}
  return {
    addEventListener: (type: string, listener: (event: { type: string }) => void) =>
      (listeners[type] ??= new Set()).add(listener),
    removeEventListener: (type: string, listener: (event: { type: string }) => void) =>
      listeners[type]?.delete(listener),
    dispatch: (type: string) => listeners[type]?.forEach(listener => listener({ type })),
    getController: vi.fn(getController),
  }
}

describe("XRControllerSource", () => {
  it("dispatches onXRSqueezeStart/End to the ray-hit mesh with a rich payload", () => {
    // Snapshot inside the handler: dispatch reuses one mutable event across the
    // bubble + canvas phases, so a retained reference reads the final state.
    let payload: Record<string, any> | undefined
    const start = vi.fn((event: any) => {
      payload = { ...event }
    })
    const end = vi.fn()
    const mesh = meta(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial()), {
      props: { onXRSqueezeStart: start, onXRSqueezeEnd: end },
    }) as unknown as THREE.Object3D
    mesh.updateMatrixWorld()

    // Offset from dead-centre: a ray through the plane's exact centre pierces
    // the diagonal shared by its two triangles (two intersections); off-centre
    // hits a single triangle, so dispatch fires once.
    const controller = new THREE.Object3D()
    controller.position.set(0.5, 0.3, 5)
    controller.updateMatrixWorld()
    const xr = makeFakeXR(index => (index === 0 ? controller : new THREE.Object3D()))
    const context = { gl: { xr }, eventRegistry: [mesh], props: {}, scene: new THREE.Scene() } as any

    const disconnect = new XRControllerSource(context, xr as any, 1).connect()
    xr.dispatch("sessionstart")

    controller.dispatchEvent({ type: "squeezestart", data: { handedness: "left" } } as any)
    expect(start).toHaveBeenCalledTimes(1)
    expect(payload!.controller).toBe(controller)
    expect(payload!.handedness).toBe("left")
    expect(payload!.element).toBe(mesh)
    expect(payload!.intersection.object).toBe(mesh)

    controller.dispatchEvent({ type: "squeezeend", data: { handedness: "left" } } as any)
    expect(end).toHaveBeenCalledTimes(1)

    xr.dispatch("sessionend")
    controller.dispatchEvent({ type: "squeezestart", data: { handedness: "left" } } as any)
    expect(start).toHaveBeenCalledTimes(1) // torn down

    disconnect()
  })

  it("xrEvents() registers a handler-bearing mesh and wires the source once per ctx", () => {
    const start = vi.fn()
    const controller = new THREE.Object3D()
    controller.position.set(0.5, 0.3, 5)
    controller.updateMatrixWorld()
    const xr = makeFakeXR(index => (index === 0 ? controller : new THREE.Object3D()))

    const T = createT({ Mesh: THREE.Mesh }, [xrEvents()])
    const three = renderThree(
      () => (
        <T.Mesh args={[new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial()]} onXRSqueezeStart={start} />
      ),
      { gl: { xr } as any },
    )
    three.scene.children[0]!.updateMatrixWorld()

    xr.dispatch("sessionstart")
    controller.dispatchEvent({ type: "squeezestart", data: { handedness: "right" } } as any)
    expect(start).toHaveBeenCalledTimes(1)
    three.unmount()
  })

  it("contributes typed onXR* handlers (XRThreeEvent) on the namespace", () => {
    const T = createT({ Mesh: THREE.Mesh }, [xrEvents()])
    type MeshProps = Parameters<typeof T.Mesh>[0]
    // lint:types errors if the handler isn't surfaced / mistyped:
    assertType<((event: XRThreeEvent) => void) | undefined>(({} as MeshProps).onXRSqueezeStart)
    expect(true).toBe(true)
  })
})
