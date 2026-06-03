import { describe, expect, it, vi } from "vitest"
import { Object3D } from "three"
import { Pointer, type PointerRaycaster } from "../../src/pointers.ts"
import { meta } from "../../src/utils.ts"

function eventful(handlers: Record<string, any>) {
  return meta(new Object3D(), { props: handlers }) as any as Object3D
}
function ctx(eventRegistry: Object3D[], props: Record<string, any> = {}) {
  return { eventRegistry, props } as any
}
// Fake raycaster: `cast` hits whatever `state.target` is; phase-2 re-cast finds nothing.
function fakeRaycaster(state: { target?: Object3D }): PointerRaycaster {
  return {
    cast: () => (state.target ? [{ object: state.target, distance: 1 } as any] : []),
    intersectObject: () => [],
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
})
