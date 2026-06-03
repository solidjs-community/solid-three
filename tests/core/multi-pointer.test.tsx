import { fireEvent } from "@solidjs/testing-library"
import * as THREE from "three"
import { afterEach, describe, expect, it, vi } from "vitest"
import { createT } from "../../src/index.ts"
import { cleanup, test } from "../../src/testing/index.tsx"

const T = createT(THREE)

afterEach(cleanup)

// Centre of the test canvas (matches the canvas-events suite's HIT coords).
const HIT_X = 640
const HIT_Y = 400
const moveAt = (pointerId: number) =>
  new PointerEvent("pointermove", { clientX: HIT_X, clientY: HIT_Y, pointerId, bubbles: true })

describe("multi-pointer", () => {
  it("tracks hover independently per pointerId", () => {
    const enter = vi.fn()
    const { canvas } = test(() => (
      <T.Mesh onPointerEnter={enter}>
        <T.BoxGeometry args={[2, 2]} />
        <T.MeshBasicMaterial />
      </T.Mesh>
    ))

    // Two distinct pointers move onto the same mesh → enter fires once per pointer
    // (a single-pointer engine would mark the mesh hovered on the first and
    // suppress the second).
    fireEvent(canvas, moveAt(1))
    fireEvent(canvas, moveAt(2))
    expect(enter).toHaveBeenCalledTimes(2)

    // Pointer 1 stays on the mesh → no re-enter for pointer 1 (its own hover state).
    fireEvent(canvas, moveAt(1))
    expect(enter).toHaveBeenCalledTimes(2)
  })

  it("leaves one pointer without disturbing another's hover", () => {
    const enter = vi.fn()
    const leave = vi.fn()
    const { canvas } = test(() => (
      <T.Mesh onPointerEnter={enter} onPointerLeave={leave}>
        <T.BoxGeometry args={[2, 2]} />
        <T.MeshBasicMaterial />
      </T.Mesh>
    ))

    fireEvent(canvas, moveAt(1))
    fireEvent(canvas, moveAt(2))
    expect(enter).toHaveBeenCalledTimes(2)

    // Pointer 1 leaves the canvas → exactly one leave (pointer 1's); pointer 2 unaffected.
    fireEvent(canvas, new PointerEvent("pointerleave", { clientX: HIT_X, clientY: HIT_Y, pointerId: 1, bubbles: true }))
    expect(leave).toHaveBeenCalledTimes(1)
  })
})
