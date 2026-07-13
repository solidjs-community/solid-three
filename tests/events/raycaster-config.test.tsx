import { fireEvent } from "@solidjs/testing-library"
import * as THREE from "three"
import { describe, expect, it, vi } from "vitest"
import { CenterRaycaster, pointerEvents } from "../../src/events/index.ts"
import { createT } from "../../src/index.ts"
import { test } from "../../src/testing/index.tsx"

/**
 * Guards the full `<Canvas raycaster={…}>` config matrix reaching the raycaster that
 * actually does picking:
 *
 *  - a props-OBJECT config (`{ far: … }`) must land on the raycaster the engine casts
 *    with, not on some other raycaster nobody consults (the regression this file pins).
 *  - a screen-raycaster INSTANCE (e.g. `CenterRaycaster`) must be used directly by the
 *    engine — config application is for the props-object form only.
 *  - no `raycaster` prop at all must still pick normally, through the engine's own
 *    default `CursorRaycaster`.
 */

// One engine instance, installed both into the namespace (so `T.Mesh` has pointer
// props) and onto the canvas (so the canvas-level `onPointerMissed` reaches it).
const engine = pointerEvents()
const T = createT(THREE, [engine])

// offsetX/Y that hits a mesh centred at origin (camera at z=5, canvas 1280×800).
const HIT_X = 640
const HIT_Y = 400

// offsetX/Y that misses a centred mesh (top-left corner of canvas).
const MISS_X = 0
const MISS_Y = 0

function clickAt(x: number, y: number) {
  return new MouseEvent("click", { clientX: x, clientY: y, bubbles: true })
}

/** A 2×2×2 box at the origin — front face at z=1, so distance from the z=5 camera is 4. */
function Box(props: { onClick?: (event: any) => void }) {
  return (
    <T.Mesh onClick={props.onClick}>
      <T.BoxGeometry args={[2, 2, 2]} />
      <T.MeshBasicMaterial />
    </T.Mesh>
  )
}

describe("<Canvas raycaster={{ ... }}> config reaches the raycaster that actually picks", () => {
  it("far excludes an object beyond it (the object sits at distance 4 from the camera)", () => {
    const onClick = vi.fn()
    const missed = vi.fn()
    const { canvas } = test(() => <Box onClick={onClick} />, {
      plugins: [engine],
      raycaster: { far: 3 },
      onPointerMissed: missed,
    })

    fireEvent(canvas, clickAt(HIT_X, HIT_Y))

    expect(onClick).not.toHaveBeenCalled()
    expect(missed).toHaveBeenCalledTimes(1)
  })

  it("control: the same object is picked when far is wide enough to include it", () => {
    const onClick = vi.fn()
    const { canvas } = test(() => <Box onClick={onClick} />, {
      plugins: [engine],
      raycaster: { far: 10, near: 1 },
    })

    fireEvent(canvas, clickAt(HIT_X, HIT_Y))

    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

describe("<Canvas raycaster={instance}> is used directly by the engine", () => {
  it("a CenterRaycaster instance keeps casting from screen centre, ignoring the cursor", () => {
    const onClick = vi.fn()
    const { canvas } = test(() => <Box onClick={onClick} />, {
      plugins: [engine],
      raycaster: new CenterRaycaster(),
    })

    // Cursor is at the top-left corner — a cursor-based raycaster would miss — but
    // CenterRaycaster always looks at screen centre, where the box sits.
    fireEvent(canvas, clickAt(MISS_X, MISS_Y))

    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

describe("no <Canvas raycaster> prop falls back to the engine's default CursorRaycaster", () => {
  it("picks the object under the cursor", () => {
    const onClick = vi.fn()
    const { canvas } = test(() => <Box onClick={onClick} />, { plugins: [engine] })

    fireEvent(canvas, clickAt(HIT_X, HIT_Y))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it("misses when the cursor is off the object", () => {
    const onClick = vi.fn()
    const { canvas } = test(() => <Box onClick={onClick} />, { plugins: [engine] })

    fireEvent(canvas, clickAt(MISS_X, MISS_Y))

    expect(onClick).not.toHaveBeenCalled()
  })
})
