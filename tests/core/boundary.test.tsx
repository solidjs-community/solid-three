import { render } from "@solidjs/testing-library"
import { onCleanup } from "solid-js"
import { Object3D, Raycaster, Vector2 } from "three"
import * as THREE from "three"
import { describe, expect, it, vi } from "vitest"
import { Canvas } from "../../src/canvas.tsx"
import { createT } from "../../src/create-t.tsx"
import { pointerEvents } from "../../src/events/index.ts"
import { useThree } from "../../src/hooks.ts"
import { plugin } from "../../src/plugin.ts"
import { test as renderThree } from "../../src/testing/index.tsx"
import type { Context } from "../../src/types.ts"
import { clickCanvasCentre } from "../utils/pointer-utils.ts"

/**
 * A minimal fake engine: records the canvas-level prop it was handed, AND keeps its
 * own registry of elements that opted in via its contributed `onFakeClick` prop.
 *
 * The registry is genuinely private to each `fakeEngine(...)` call — a fresh `Set`
 * closed over by both `install` and the per-element method, never shared with any
 * other engine (fake or real). On a real click on the canvas, `install` raycasts
 * ONLY that registry — never the whole scene — and calls `onRegistryHit` with the hit
 * object. That is the mechanism the "disjoint provenance" suite exercises: it proves
 * two engines installed on the same canvas never see each other's registered objects.
 *
 * `onRegistryHit` defaults to `received` (the canvas-props-channel tests only care
 * about that one); pass it explicitly when a test needs to tell a genuine registry hit
 * apart from the canvas-prop channel's own unconditional mount-time call (every
 * contributed canvas prop is fed its current value once at mount, `undefined` if the
 * consumer never passed it — see `create-three.tsx`'s per-plugin `createRenderEffect`).
 */
function fakeEngine(
  name: string,
  received: (value: unknown) => void,
  onRegistryHit: (object: Object3D) => void = received,
) {
  const registry = new Set<Object3D>()
  return Object.assign(
    plugin([Object3D], (object: Object3D) => ({
      onFakeClick: (handler: unknown) => {
        if (typeof handler !== "function") return
        registry.add(object)
        onCleanup(() => registry.delete(object))
      },
    })),
    {
      token: Symbol(name),
      install: (context: Context) => {
        const onClick = (event: MouseEvent) => {
          const { width, height } = context.bounds
          const ndc = new Vector2(
            (event.offsetX / width) * 2 - 1,
            -(event.offsetY / height) * 2 + 1,
          )
          const raycaster = new Raycaster()
          raycaster.setFromCamera(ndc, context.camera)
          const hits = raycaster.intersectObjects([...registry], false)
          if (hits.length > 0) onRegistryHit(hits[0].object)
        }
        context.canvas.addEventListener("click", onClick)
        onCleanup(() => context.canvas.removeEventListener("click", onClick))
      },
      canvas: (context: Context) => ({
        onFakeMissed: (value: unknown) => received(value),
      }),
    },
  )
}

describe("canvas-props channel", () => {
  it("delivers a contributed canvas prop to the engine that declared it", async () => {
    const received = vi.fn()
    const engine = fakeEngine("a", received)
    const handler = () => {}

    render(() => (
      <Canvas plugins={[engine]} onFakeMissed={handler}>
        {null}
      </Canvas>
    ))
    await Promise.resolve()

    expect(received).toHaveBeenCalledWith(handler)
  })

  it("warns and last-wins when two engines contribute the same canvas prop", async () => {
    const first = vi.fn()
    const second = vi.fn()
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const handler = () => {}

    render(() => (
      <Canvas
        plugins={[fakeEngine("first", first), fakeEngine("second", second)]}
        onFakeMissed={handler}
      >
        {null}
      </Canvas>
    ))
    await Promise.resolve()

    expect(second).toHaveBeenCalledWith(handler)
    expect(first).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("onFakeMissed"))
    warn.mockRestore()
  })
})

describe("createT.withCanvas", () => {
  it("returns a Canvas with the plugins pre-bound", async () => {
    const received = vi.fn()
    const engine = fakeEngine("bound", received)
    const handler = () => {}

    const { T, Canvas: BoundCanvas } = createT.withCanvas(THREE, [engine])

    render(() => (
      <BoundCanvas onFakeMissed={handler}>
        <T.Mesh />
      </BoundCanvas>
    ))
    await Promise.resolve()

    expect(received).toHaveBeenCalledWith(handler)
  })

  it("still lets an explicit plugins prop override the pre-bound default", async () => {
    const defaultReceived = vi.fn()
    const overrideReceived = vi.fn()
    const defaultEngine = fakeEngine("default", defaultReceived)
    const overrideEngine = fakeEngine("override", overrideReceived)
    const handler = () => {}

    const { T, Canvas: BoundCanvas } = createT.withCanvas(THREE, [defaultEngine])

    render(() => (
      <BoundCanvas plugins={[overrideEngine]} onFakeMissed={handler}>
        <T.Mesh />
      </BoundCanvas>
    ))
    await Promise.resolve()

    expect(overrideReceived).toHaveBeenCalledWith(handler)
    expect(defaultReceived).not.toHaveBeenCalled()
  })
})

describe("core's raycaster", () => {
  it("keeps a plain raycaster in core, reachable from useThree, with no engine installed", async () => {
    let seen: unknown
    await renderThree(() => {
      seen = useThree().raycaster
      return null
    })
    expect(seen).toBeInstanceOf(Raycaster)
    // A plain `Raycaster` has no event-strategy methods — those belong to the
    // engine's `EventRaycaster`/`ScreenRaycaster` subclasses. Asserting only
    // `toBeInstanceOf(Raycaster)` would pass even if core still defaulted to
    // an engine raycaster (every engine raycaster IS a Raycaster), so this
    // also checks core did not smuggle one in.
    expect(seen && "cast" in (seen as object)).toBe(false)
    expect(seen && "setCursor" in (seen as object)).toBe(false)
  })

  it("core has no event registry", async () => {
    let context: Context | undefined
    await renderThree(() => {
      context = useThree()
      return null
    })
    expect(context && "eventRegistry" in context).toBe(false)
  })

  it("never calls the raycaster's picking methods across a rendered frame, with no engine installed", async () => {
    const three = renderThree(() => null)
    const intersectObjects = vi.spyOn(three.raycaster, "intersectObjects")
    const setFromCamera = vi.spyOn(three.raycaster, "setFromCamera")

    await three.waitTillNextFrame()

    expect(intersectObjects).not.toHaveBeenCalled()
    expect(setFromCamera).not.toHaveBeenCalled()
    three.unmount()
  })
})

describe("no engine, no events", () => {
  it("attaches no canvas listeners and dispatches nothing", async () => {
    const T = createT(THREE)
    const addEventListener = vi.spyOn(HTMLCanvasElement.prototype, "addEventListener")

    await renderThree(() => <T.Mesh />)

    const pointerListeners = addEventListener.mock.calls.filter(([type]) =>
      String(type).startsWith("pointer") ||
      ["click", "dblclick", "contextmenu", "wheel"].includes(String(type)),
    )
    expect(pointerListeners).toHaveLength(0)
    addEventListener.mockRestore()
  })

  it("does not accept onClick as a prop of T.Mesh (type-level)", () => {
    const T = createT(THREE)
    const three = renderThree(() => (
      // @ts-expect-error onClick is contributed by the event engine; without it, it does not exist.
      <T.Mesh onClick={() => {}} />
    ))
    three.unmount()
  })
})

describe("disjoint provenance", () => {
  it("a click on one namespace's mesh never reaches the other engine's registry", async () => {
    const engineA = pointerEvents()
    // `otherReceived` observes ONLY genuine registry hits — kept apart from the
    // canvas-props channel's own unconditional mount-time call (see `fakeEngine`'s
    // doc comment), which would otherwise make `not.toHaveBeenCalled()` fail for a
    // reason that has nothing to do with provenance.
    const otherReceived = vi.fn()
    const engineB = fakeEngine("other", vi.fn(), otherReceived)

    const TDom = createT(THREE, [engineA])
    const TOther = createT(THREE, [engineB])
    const clicked = vi.fn()

    const { canvas, waitTillNextFrame } = renderThree(
      () => (
        <>
          <TDom.Mesh onClick={clicked}>
            <TDom.BoxGeometry args={[2, 2]} />
            <TDom.MeshBasicMaterial />
          </TDom.Mesh>
          {/* Off to the side: a real click at the canvas centre must never hit this,
              whatever its own engine's registry (mis)reports. */}
          <TOther.Mesh onFakeClick={() => {}} position-x={100}>
            <TOther.BoxGeometry args={[2, 2]} />
            <TOther.MeshBasicMaterial />
          </TOther.Mesh>
        </>
      ),
      { plugins: [engineA, engineB] },
    )
    await waitTillNextFrame() // TOther.Mesh's offset position only reaches the raycaster after a frame

    // Click the centre of the canvas, where TDom.Mesh sits.
    clickCanvasCentre(canvas)

    expect(clicked).toHaveBeenCalledTimes(1)
    expect(otherReceived).not.toHaveBeenCalled()
  })
})

describe("token stability", () => {
  it("two pointerEvents() instances install one manager and dispatch once", async () => {
    const first = pointerEvents()
    const second = pointerEvents()
    const clicked = vi.fn()
    const T = createT(THREE, [first])
    const addEventListener = vi.spyOn(HTMLCanvasElement.prototype, "addEventListener")

    const { canvas } = renderThree(
      () => (
        <T.Mesh onClick={clicked}>
          <T.BoxGeometry args={[2, 2]} />
          <T.MeshBasicMaterial />
        </T.Mesh>
      ),
      { plugins: [first, second] },
    )

    // A second installed manager would attach a second "pointerdown" listener even
    // before any click — catches a double-install that a single click might not
    // observably double-dispatch (e.g. if only the most-recently-installed engine
    // ever gets objects registered into it).
    const pointerDownListeners = addEventListener.mock.calls.filter(
      ([type]) => type === "pointerdown",
    )
    expect(pointerDownListeners).toHaveLength(1)
    addEventListener.mockRestore()

    clickCanvasCentre(canvas)
    expect(clicked).toHaveBeenCalledTimes(1)
  })
})
