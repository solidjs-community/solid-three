import { fireEvent } from "@solidjs/testing-library"
import { Show, createEffect, createSignal, onCleanup } from "solid-js"
import * as THREE from "three"
import { describe, expect, it, vi } from "vitest"
import {
  CenterRaycaster,
  CursorRaycaster,
  pointerEvents,
  useRaycaster,
} from "../../src/events/index.ts"
import type { ScreenRaycaster } from "../../src/events/raycasters.ts"
import { createT } from "../../src/index.ts"
import { test } from "../../src/testing/index.tsx"

/**
 * The raycaster is a STACK, owned by the engine. The engine's own raycaster sits at the
 * bottom; a subtree pushes its own over it with `setRaycaster` and pops on unmount.
 *
 * What makes the stack real — and what these tests are here to hold — is that the engine
 * reads the TOP OF THE STACK at cast/aim time rather than capturing a raycaster at install.
 * So the assertions are about what gets HIT, not merely about which object the hook returns:
 * a stack that doesn't change picking is a stack that does nothing.
 */

const engine = pointerEvents()
const T = createT(THREE, [engine])

// offsetX/Y that hits a mesh centred at origin (camera at z=5, canvas 1280×800).
const HIT_X = 640
const HIT_Y = 400

// offsetX/Y that misses a centred mesh (top-left corner of canvas) — for a cursor-aimed
// raycaster. A CenterRaycaster ignores the cursor and hits the box from here anyway.
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

/** A subtree that picks by gaze: pushes a `CenterRaycaster`, pops it when it unmounts. */
function Gaze() {
  const { setRaycaster } = useRaycaster()
  const restore = setRaycaster(new CenterRaycaster())
  onCleanup(restore)
  return null
}

describe("setRaycaster() pushes a raycaster that actually picks", () => {
  it("a pushed CenterRaycaster changes the hit result: a corner click now reaches the centred box", () => {
    const onClick = vi.fn()
    const [gazing, setGazing] = createSignal(false)

    const { canvas } = test(
      () => (
        <>
          <Box onClick={onClick} />
          <Show when={gazing()}>
            <Gaze />
          </Show>
        </>
      ),
      { plugins: [engine] },
    )

    // Bottom of the stack: the engine's default CursorRaycaster. The corner misses.
    fireEvent(canvas, clickAt(MISS_X, MISS_Y))
    expect(onClick).not.toHaveBeenCalled()

    setGazing(true)

    // The pushed CenterRaycaster aims from the screen centre whatever the cursor does —
    // so the very same corner click now hits the box.
    fireEvent(canvas, clickAt(MISS_X, MISS_Y))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it("a pushed raycaster with a short `far` puts an in-reach object out of reach", () => {
    const onClick = vi.fn()
    const [limiting, setLimiting] = createSignal(false)

    const ShortReach = () => {
      const { setRaycaster } = useRaycaster()
      const shortReach = new CursorRaycaster()
      shortReach.far = 3 // the box's front face is at distance 4
      const restore = setRaycaster(shortReach)
      onCleanup(restore)
      return null
    }

    const { canvas } = test(
      () => (
        <>
          <Box onClick={onClick} />
          <Show when={limiting()}>
            <ShortReach />
          </Show>
        </>
      ),
      { plugins: [engine] },
    )

    fireEvent(canvas, clickAt(HIT_X, HIT_Y))
    expect(onClick).toHaveBeenCalledTimes(1)

    setLimiting(true)

    fireEvent(canvas, clickAt(HIT_X, HIT_Y))
    expect(onClick).toHaveBeenCalledTimes(1) // still the one from before — out of reach now
  })
})

describe("popping the stack restores the previous raycaster", () => {
  it("unmounting the overriding subtree reverts picking to the raycaster underneath", () => {
    const onClick = vi.fn()
    const [gazing, setGazing] = createSignal(false)

    const { canvas } = test(
      () => (
        <>
          <Box onClick={onClick} />
          <Show when={gazing()}>
            <Gaze />
          </Show>
        </>
      ),
      { plugins: [engine] },
    )

    setGazing(true)
    fireEvent(canvas, clickAt(MISS_X, MISS_Y))
    expect(onClick).toHaveBeenCalledTimes(1) // gaze: the corner click hits

    setGazing(false) // the subtree unmounts, popping its raycaster

    fireEvent(canvas, clickAt(MISS_X, MISS_Y))
    expect(onClick).toHaveBeenCalledTimes(1) // back to the cursor: the corner misses again

    // And the raycaster underneath is picking again, not merely present.
    fireEvent(canvas, clickAt(HIT_X, HIT_Y))
    expect(onClick).toHaveBeenCalledTimes(2)
  })

  it("restores the engine's OWN raycaster — the bottom of the stack — not some fresh default", () => {
    const gazeBase = new CenterRaycaster()
    const configured = pointerEvents({ raycaster: gazeBase })
    const [overriding, setOverriding] = createSignal(false)
    const seen: ScreenRaycaster[] = []

    const Override = () => {
      const { setRaycaster } = useRaycaster()
      const restore = setRaycaster(new CursorRaycaster())
      onCleanup(restore)
      return null
    }

    test(
      () => {
        const { raycaster } = useRaycaster()
        createEffect(() => seen.push(raycaster()))
        return (
          <Show when={overriding()}>
            <Override />
          </Show>
        )
      },
      { plugins: [configured] },
    )

    expect(seen.at(-1)).toBe(gazeBase)

    setOverriding(true)
    expect(seen.at(-1)).toBeInstanceOf(CursorRaycaster)

    setOverriding(false)
    expect(seen.at(-1)).toBe(gazeBase) // the very object the engine was configured with
  })
})

describe("raycaster() is an accessor, not a getter", () => {
  /**
   * The maintainer destructures the hook's result. A getter on the returned object would
   * snapshot the raycaster at destructuring time and silently lose reactivity — so the
   * accessor is destructured HERE, before anything is pushed, and must still observe the
   * push that happens later, from a subtree it knows nothing about.
   */
  it("survives destructuring and reactively tracks the top of the stack", () => {
    const [gazing, setGazing] = createSignal(false)
    const seen: ScreenRaycaster[] = []

    test(
      () => {
        const { raycaster } = useRaycaster() // destructured up front
        createEffect(() => seen.push(raycaster()))
        return (
          <Show when={gazing()}>
            <Gaze />
          </Show>
        )
      },
      { plugins: [engine] },
    )

    expect(seen).toHaveLength(1)
    const base = seen[0]
    expect(base).toBeInstanceOf(CursorRaycaster)

    setGazing(true)

    // The effect re-ran: the destructured accessor saw the push.
    expect(seen).toHaveLength(2)
    expect(seen[1]).toBeInstanceOf(CenterRaycaster)

    setGazing(false)

    expect(seen).toHaveLength(3)
    expect(seen[2]).toBe(base)
  })
})
