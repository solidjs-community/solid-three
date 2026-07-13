import { render } from "@solidjs/testing-library"
import { Object3D, Raycaster } from "three"
import * as THREE from "three"
import { describe, expect, it, vi } from "vitest"
import { Canvas } from "../../src/canvas.tsx"
import { createT } from "../../src/create-t.tsx"
import { useThree } from "../../src/hooks.ts"
import { plugin } from "../../src/plugin.ts"
import { test as renderThree } from "../../src/testing/index.tsx"
import type { Context } from "../../src/types.ts"

/** A minimal fake engine: records the canvas-level prop it was handed. */
function fakeEngine(name: string, received: (value: unknown) => void) {
  return Object.assign(
    plugin([Object3D], () => ({ onFakeClick: (_handler: () => void) => {} })),
    {
      token: Symbol(name),
      install: (_context: Context) => {},
      canvas: (_context: Context) => ({
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
