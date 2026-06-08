import { fireEvent } from "@solidjs/testing-library"
import { createSignal } from "solid-js"
import * as THREE from "three"
import { describe, expect, it, vi } from "vitest"
import { createT } from "../../src/index.ts"
import { test } from "../../src/testing/index.tsx"

const T = createT(THREE)

describe("events", () => {
  it("can handle onPointerDown", async () => {
    const handlePointerDown = vi.fn()

    const { canvas } = test(() => (
      <T.Mesh onPointerDown={handlePointerDown}>
        <T.BoxGeometry args={[2, 2]} />
        <T.MeshBasicMaterial />
      </T.Mesh>
    ))

    fireEvent(
      canvas,
      new PointerEvent("pointerdown", { clientX: 640, clientY: 400, pointerId: 1, bubbles: true }),
    )

    expect(handlePointerDown).toHaveBeenCalled()
  })

  it("can handle onPointerMove", async () => {
    const handlePointerMove = vi.fn()
    const handlePointerEnter = vi.fn()
    const handlePointerOut = vi.fn()

    const { canvas } = test(() => (
      <T.Mesh
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerOut}
        onPointerMove={handlePointerMove}
      >
        <T.BoxGeometry args={[2, 2]} />
        <T.MeshBasicMaterial />
      </T.Mesh>
    ))

    fireEvent(
      canvas,
      new PointerEvent("pointermove", { clientX: 577, clientY: 480, bubbles: true }),
    )

    expect(handlePointerMove).toHaveBeenCalled()
    expect(handlePointerEnter).toHaveBeenCalled()

    fireEvent(canvas, new PointerEvent("pointermove", { clientX: 0, clientY: 0, bubbles: true }))

    expect(handlePointerOut).toHaveBeenCalled()
  })

  it("should handle stopPropogation", async () => {
    // onPointerEnter/Leave are non-stoppable (DOM-like behavior)
    const handlePointerEnter = vi.fn()
    const handlePointerLeave = vi.fn()

    const { canvas } = test(() => (
      <>
        <T.Mesh onPointerLeave={handlePointerLeave} onPointerEnter={handlePointerEnter}>
          <T.BoxGeometry args={[2, 2]} />
          <T.MeshBasicMaterial />
        </T.Mesh>
        <T.Mesh position-z={3}>
          <T.BoxGeometry args={[2, 2]} />
          <T.MeshBasicMaterial />
        </T.Mesh>
      </>
    ))

    fireEvent(
      canvas,
      new PointerEvent("pointermove", { clientX: 577, clientY: 480, bubbles: true }),
    )

    expect(handlePointerEnter).toHaveBeenCalled()

    fireEvent(canvas, new PointerEvent("pointermove", { clientX: 0, clientY: 0, bubbles: true }))

    expect(handlePointerLeave).toHaveBeenCalled()
  })

  it("should handle stopPropagation on click events", async () => {
    const handleClickFront = vi.fn(e => e.stopPropagation())
    const handleClickRear = vi.fn()

    const { canvas } = test(() => (
      <>
        <T.Mesh onClick={handleClickFront}>
          <T.BoxGeometry args={[2, 2]} />
          <T.MeshBasicMaterial />
        </T.Mesh>
        <T.Mesh onClick={handleClickRear} position-z={-3}>
          <T.BoxGeometry args={[2, 2]} />
          <T.MeshBasicMaterial />
        </T.Mesh>
      </>
    ))

    const at = { clientX: 577, clientY: 480, bubbles: true }
    fireEvent(canvas, new PointerEvent("pointerdown", at))
    fireEvent(canvas, new PointerEvent("pointerup", at))
    fireEvent(canvas, new MouseEvent("click", at))

    expect(handleClickFront).toHaveBeenCalled()
    expect(handleClickRear).not.toHaveBeenCalled()
  })
})

/**********************************************************************************/
/*                                                                                */
/*                              Shared click helpers                              */
/*                                                                                */
/**********************************************************************************/

const HIT_X = 640
const HIT_Y = 400
const MISS_X = 0
const MISS_Y = 0

function makeClickAt(clientX: number, clientY: number) {
  // Canvas is at (0, 0) in document.body, so offsetX/Y === clientX/Y.
  return new MouseEvent("click", { clientX, clientY, bubbles: true })
}

describe("void via event.object", () => {
  it("fires canvas onClick with event.object undefined when the click misses every mesh", async () => {
    let object: unknown = "unset"

    const { canvas } = await test(
      () => (
        <T.Mesh>
          <T.BoxGeometry args={[2, 2]} />
          <T.MeshBasicMaterial />
        </T.Mesh>
      ),
      { onClick: (event: any) => (object = event.object) },
    )

    fireEvent(canvas, makeClickAt(MISS_X, MISS_Y))

    expect(object).toBeUndefined()
  })

  it("fires canvas onClick with event.object set to the hit mesh", async () => {
    let object: any = "unset"

    const { canvas } = await test(
      () => (
        <T.Mesh onClick={() => {}}>
          <T.BoxGeometry args={[2, 2]} />
          <T.MeshBasicMaterial />
        </T.Mesh>
      ),
      { onClick: (event: any) => (object = event.object) },
    )

    fireEvent(canvas, makeClickAt(HIT_X, HIT_Y))

    expect(object?.isMesh).toBe(true)
  })
})

/**********************************************************************************/
/*                                                                                */
/*                          Event handler reactivity                              */
/*                                                                                */
/**********************************************************************************/

describe("event handler reactivity", () => {
  it("registers object in interaction list when event prop is added", async () => {
    const handleClick = vi.fn()
    const [onClick, setOnClick] = createSignal<((e: any) => void) | undefined>(undefined)

    const { canvas } = await test(() => (
      <T.Mesh onClick={onClick()}>
        <T.BoxGeometry args={[2, 2]} />
        <T.MeshBasicMaterial />
      </T.Mesh>
    ))

    // No handler yet — click should not fire
    fireEvent(canvas, makeClickAt(HIT_X, HIT_Y))

    expect(handleClick).not.toHaveBeenCalled()

    // Add the handler reactively
    setOnClick(() => handleClick)

    fireEvent(canvas, makeClickAt(HIT_X, HIT_Y))

    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it("removes object from interaction list when event prop is removed", async () => {
    const handleClick = vi.fn()
    const [onClick, setOnClick] = createSignal<((e: any) => void) | undefined>(handleClick)

    const { canvas } = await test(() => (
      <T.Mesh onClick={onClick()}>
        <T.BoxGeometry args={[2, 2]} />
        <T.MeshBasicMaterial />
      </T.Mesh>
    ))

    // Handler active — click fires
    fireEvent(canvas, makeClickAt(HIT_X, HIT_Y))

    expect(handleClick).toHaveBeenCalledTimes(1)

    // Remove handler reactively
    setOnClick(undefined)

    fireEvent(canvas, makeClickAt(HIT_X, HIT_Y))

    expect(handleClick).toHaveBeenCalledTimes(1) // no new call
  })
})
