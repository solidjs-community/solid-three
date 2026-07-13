import { fireEvent } from "@solidjs/testing-library"
import { ErrorBoundary } from "solid-js"
import * as THREE from "three"
import { describe, expect, it, vi } from "vitest"
import { CenterRaycaster, pointerEvents, useRaycaster } from "../../src/events/index.ts"
import type { ScreenRaycaster } from "../../src/events/raycasters.ts"
import { createT } from "../../src/index.ts"
import { test } from "../../src/testing/index.tsx"

/**
 * The engine owns the raycaster — core has none. This file guards the two ways to reach
 * it, and that both reach the SAME object, the one that actually picks:
 *
 *  - `pointerEvents({ raycaster })` at setup: a config OBJECT (`{ far: … }`) applied to
 *    the engine's own `CursorRaycaster`, or a screen-raycaster INSTANCE (e.g.
 *    `CenterRaycaster`) used as the whole ray strategy. Plus the no-option default.
 *  - `useRaycaster()` at runtime: mutating the raycaster it hands back must change what gets
 *    picked. (Pushing a different raycaster over it — the stack — is `raycaster-stack.test.tsx`.)
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

describe("pointerEvents({ raycaster: config }) configures the raycaster that actually picks", () => {
  it("far excludes an object beyond it (the object sits at distance 4 from the camera)", () => {
    const onClick = vi.fn()
    const missed = vi.fn()
    const configured = pointerEvents({ raycaster: { far: 3 } })
    const { canvas } = test(() => <Box onClick={onClick} />, {
      plugins: [configured],
      onPointerMissed: missed,
    })

    fireEvent(canvas, clickAt(HIT_X, HIT_Y))

    expect(onClick).not.toHaveBeenCalled()
    expect(missed).toHaveBeenCalledTimes(1)
  })

  it("control: the same object is picked when far is wide enough to include it", () => {
    const onClick = vi.fn()
    const configured = pointerEvents({ raycaster: { far: 10, near: 1 } })
    const { canvas } = test(() => <Box onClick={onClick} />, {
      plugins: [configured],
    })

    fireEvent(canvas, clickAt(HIT_X, HIT_Y))

    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

describe("pointerEvents({ raycaster: instance }) is used directly by the engine", () => {
  it("a CenterRaycaster instance keeps casting from screen centre, ignoring the cursor", () => {
    const onClick = vi.fn()
    const configured = pointerEvents({ raycaster: new CenterRaycaster() })
    const { canvas } = test(() => <Box onClick={onClick} />, {
      plugins: [configured],
    })

    // Cursor is at the top-left corner — a cursor-based raycaster would miss — but
    // CenterRaycaster always looks at screen centre, where the box sits.
    fireEvent(canvas, clickAt(MISS_X, MISS_Y))

    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

describe("no raycaster option falls back to the engine's default CursorRaycaster", () => {
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

describe("useRaycaster()", () => {
  /**
   * The point of moving the raycaster into the engine. There is exactly ONE raycaster on
   * the canvas now, so a runtime mutation through the hook lands on the object that
   * picks. This test is what a second, inert raycaster (core's old `useThree().raycaster`,
   * which nothing ever cast with) fails: the click after `far = 3` would still hit, and
   * the final `toHaveBeenCalledTimes(1)` would read 2.
   */
  it("far, set at runtime, changes what gets picked", () => {
    const onClick = vi.fn()
    const missed = vi.fn()
    let raycaster: ScreenRaycaster | undefined

    const { canvas } = test(
      () => {
        raycaster = useRaycaster().raycaster()
        return <Box onClick={onClick} />
      },
      { plugins: [engine], onPointerMissed: missed },
    )

    // Control: with the engine's default reach, the box (distance 4) is picked.
    fireEvent(canvas, clickAt(HIT_X, HIT_Y))
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(missed).not.toHaveBeenCalled()

    if (!raycaster) throw new Error("useRaycaster() returned nothing")
    raycaster.far = 3 // now shorter than the box's front face at distance 4

    fireEvent(canvas, clickAt(HIT_X, HIT_Y))
    expect(onClick).toHaveBeenCalledTimes(1) // still the one from before — the box is out of reach
    expect(missed).toHaveBeenCalledTimes(1)
  })

  it("hands out the very raycaster the engine was configured with", () => {
    const centerRaycaster = new CenterRaycaster()
    const configured = pointerEvents({ raycaster: centerRaycaster })
    let seen: ScreenRaycaster | undefined

    test(
      () => {
        seen = useRaycaster().raycaster()
        return null
      },
      { plugins: [configured] },
    )

    expect(seen).toBe(centerRaycaster)
  })

  it("throws on a canvas with no engine installed, rather than handing back an inert raycaster", () => {
    let error: unknown
    const Probe = () => {
      useRaycaster()
      return null
    }

    test(() => (
      <ErrorBoundary
        fallback={caught => {
          error = caught
          return null
        }}
      >
        <Probe />
      </ErrorBoundary>
    ))

    expect(error).toBeInstanceOf(Error)
    expect(String(error)).toContain("useRaycaster()")
  })
})
