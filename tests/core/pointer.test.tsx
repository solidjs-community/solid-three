import { describe, expect, it, vi } from "vitest"
import { Object3D, Ray, Vector3 } from "three"
import { Pointer, type PointerRaycaster } from "../../src/pointers.ts"
import { meta } from "../../src/utils.ts"

function eventful(handlers: Record<string, any>) {
  return meta(new Object3D(), { props: handlers }) as any as Object3D
}
function ctx(eventRegistry: Object3D[], props: Record<string, any> = {}) {
  return { eventRegistry, props } as any
}
// Fake raycaster: `cast` hits whatever `state.target` is (with a point+face so
// capture() can build a plane); phase-2 re-cast finds nothing; `aim` is a no-op
// (tests position `ray` directly).
function fakeRaycaster(state: {
  target?: Object3D
  point?: Vector3
  normal?: Vector3
}): PointerRaycaster {
  return {
    cast: () =>
      state.target
        ? [
            {
              object: state.target,
              distance: 1,
              point: (state.point ?? new Vector3()).clone(),
              face: { normal: (state.normal ?? new Vector3(0, 0, 1)).clone() },
            } as any,
          ]
        : [],
    intersectObject: () => [],
    aim: () => {},
    ray: new Ray(),
  }
}

describe("Pointer dispatch", () => {
  it("fires onPointerEnter on first hover and onPointerLeave when it moves off", () => {
    const enter = vi.fn()
    const leave = vi.fn()
    const mesh = eventful({ onPointerEnter: enter, onPointerLeave: leave })
    const state: { target?: Object3D } = { target: mesh }
    const pointer = new Pointer(ctx([mesh]), fakeRaycaster(state))

    pointer.move(new Event("pointermove"))
    expect(enter).toHaveBeenCalledTimes(1)

    state.target = undefined
    pointer.move(new Event("pointermove"))
    expect(leave).toHaveBeenCalledTimes(1)
  })

  it("does not re-fire enter while staying on the object", () => {
    const enter = vi.fn()
    const mesh = eventful({ onPointerEnter: enter })
    const pointer = new Pointer(ctx([mesh]), fakeRaycaster({ target: mesh }))

    pointer.move(new Event("pointermove"))
    pointer.move(new Event("pointermove"))
    expect(enter).toHaveBeenCalledTimes(1)
  })

  it("bubbles onPointerMove up the ancestor chain and honors stopPropagation", () => {
    const parentMove = vi.fn()
    const childMove = vi.fn((event: any) => event.stopPropagation())
    const parent = eventful({ onPointerMove: parentMove })
    const child = eventful({ onPointerMove: childMove })
    ;(child as any).parent = parent
    const pointer = new Pointer(ctx([child]), fakeRaycaster({ target: child }))

    pointer.move(new Event("pointermove"))
    expect(childMove).toHaveBeenCalledTimes(1)
    expect(parentMove).not.toHaveBeenCalled()
  })

  it("fires onClick on the hit object", () => {
    const click = vi.fn()
    const mesh = eventful({ onClick: click })
    const pointer = new Pointer(ctx([mesh]), fakeRaycaster({ target: mesh }))

    pointer.click("onClick", new MouseEvent("click"))
    expect(click).toHaveBeenCalledTimes(1)
  })

  it("fires onClickMissed (mesh-level + canvas-level) when the click hits nothing", () => {
    const meshMissed = vi.fn()
    const canvasMissed = vi.fn()
    const mesh = eventful({ onClickMissed: meshMissed })
    const pointer = new Pointer(ctx([mesh], { onClickMissed: canvasMissed }), fakeRaycaster({}))

    pointer.click("onClick", new MouseEvent("click"))
    expect(meshMissed).toHaveBeenCalledTimes(1)
    expect(canvasMissed).toHaveBeenCalledTimes(1)
  })

  it("dispatch sets event.element to the bubbling node and merges extra fields", () => {
    const seen: any[] = []
    const parent = eventful({ onPing: (e: any) => seen.push({ element: e.element, k: e.k }) })
    const child = eventful({ onPing: (e: any) => seen.push({ element: e.element, k: e.k }) })
    ;(child as any).parent = parent
    const pointer = new Pointer(ctx([child]), fakeRaycaster({ target: child }))

    ;(pointer as any).dispatch("onPing", new Event("x"), { k: 42 })
    expect(seen[0].element).toBe(child) // handler on child sees child
    expect(seen[1].element).toBe(parent) // bubbled handler on parent sees parent
    expect(seen.every(s => s.k === 42)).toBe(true) // extra merged onto every dispatch
  })
})

// A minimal capture sink that records calls.
function spySink() {
  return { capture: vi.fn(), release: vi.fn() }
}

describe("Pointer capture lifecycle", () => {
  it("capture() stores the object and calls the sink; release() clears it and calls the sink", () => {
    const mesh = eventful({})
    const sink = spySink()
    const pointer = new Pointer(ctx([mesh]), fakeRaycaster({ target: mesh }), sink)

    pointer.capture(mesh, { point: new Vector3(), face: { normal: new Vector3(0, 0, 1) } } as any)
    expect(sink.capture).toHaveBeenCalledTimes(1)
    expect(pointer.hasCaptured(mesh)).toBe(true)

    pointer.release()
    expect(sink.release).toHaveBeenCalledTimes(1)
    expect(pointer.hasCaptured(mesh)).toBe(false)
  })

  it("dropCapture() clears state WITHOUT calling the sink's release", () => {
    const mesh = eventful({})
    const sink = spySink()
    const pointer = new Pointer(ctx([mesh]), fakeRaycaster({ target: mesh }), sink)

    pointer.capture(mesh, { point: new Vector3(), face: { normal: new Vector3(0, 0, 1) } } as any)
    pointer.dropCapture()
    expect(pointer.hasCaptured(mesh)).toBe(false)
    expect(sink.release).not.toHaveBeenCalled()
  })

  it("capture(null) is a no-op", () => {
    const sink = spySink()
    const pointer = new Pointer(ctx([]), fakeRaycaster({}), sink)
    pointer.capture(null as any, {} as any)
    expect(sink.capture).not.toHaveBeenCalled()
  })
})
