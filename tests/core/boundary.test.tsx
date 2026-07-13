import { render } from "@solidjs/testing-library"
import { Object3D } from "three"
import { describe, expect, it, vi } from "vitest"
import { Canvas } from "../../src/canvas.tsx"
import { plugin } from "../../src/plugin.ts"
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
