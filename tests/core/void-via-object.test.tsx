import { fireEvent } from "@solidjs/testing-library"
import * as THREE from "three"
import { describe, expect, it } from "vitest"
import { createT } from "../../src/index.ts"
import { test } from "../../src/testing/index.tsx"

const T = createT(THREE)

// A 2×2 box at origin; the test camera makes (640, 400) hit it and (0, 0) miss.
const Box = (props: Record<string, unknown>) => (
  <T.Mesh {...props}>
    <T.BoxGeometry args={[2, 2]} />
    <T.MeshBasicMaterial />
  </T.Mesh>
)

// Every canvas-level gesture flows through the same dispatch path, so the void
// model — "the canvas always hears it; event.object is undefined on a miss" —
// should hold identically for all of them.
const GESTURES = [
  { prop: "onClick", type: "click", Ctor: MouseEvent },
  { prop: "onDoubleClick", type: "dblclick", Ctor: MouseEvent },
  { prop: "onContextMenu", type: "contextmenu", Ctor: MouseEvent },
  { prop: "onPointerDown", type: "pointerdown", Ctor: PointerEvent },
  { prop: "onPointerUp", type: "pointerup", Ctor: PointerEvent },
  { prop: "onPointerMove", type: "pointermove", Ctor: PointerEvent },
  { prop: "onWheel", type: "wheel", Ctor: WheelEvent },
] as const

const makeEvent = (Ctor: any, type: string, x: number, y: number) =>
  new Ctor(type, { clientX: x, clientY: y, bubbles: true, pointerId: 1 })

describe("void via event.object", () => {
  for (const { prop, type, Ctor } of GESTURES) {
    it(`${prop} fires on the canvas with event.object undefined on a void`, () => {
      let object: unknown = "unset"
      const { canvas } = test(() => <Box onClick={() => {}} />, {
        [prop]: (event: any) => (object = event.object),
      })

      fireEvent(canvas, makeEvent(Ctor, type, 0, 0))

      expect(object).toBeUndefined()
    })

    it(`${prop} fires on the canvas with event.object set to the mesh on a hit`, () => {
      let object: any = "unset"
      const { canvas } = test(() => <Box onClick={() => {}} />, {
        [prop]: (event: any) => (object = event.object),
      })

      fireEvent(canvas, makeEvent(Ctor, type, 640, 400))

      expect(object?.isMesh).toBe(true)
    })
  }
})
