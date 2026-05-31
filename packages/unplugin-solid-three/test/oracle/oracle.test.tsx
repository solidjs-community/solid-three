import { render } from "@solidjs/testing-library"
import * as THREE from "three"
import { describe, expect, it, vi } from "vitest"
import expected from "./oracle.generated.json"
import { requestedKeys } from "./shim.ts"

// Route createT through the recording shim, wrapping the REAL factory (via
// importOriginal) so the mock never recurses into itself. Canvas and the
// entity components come from this SAME mocked module, so they share one
// threeContext instance (importing the harness from solid-three/testing
// instead would load a second bundle with its own context → "hooks outside
// Canvas").
vi.mock("solid-three", async orig => {
  const real = await orig<typeof import("solid-three")>()
  const { wrap } = await import("./shim.ts")
  return { ...real, createT: wrap(real.createT as never) }
})

const FIXTURE = "scene.fixture.tsx"

// solid-three's frameloop raycasts every frame; against a geometry whose
// boundingSphere isn't computed yet it throws asynchronously, AFTER our
// assertion. That render-loop race is incidental to the oracle (which only
// needs the keys recorded at mount), so swallow exactly that error — anything
// else still fails the run.
if (typeof window !== "undefined") {
  window.addEventListener("error", event => {
    if (event.message?.includes("boundingSphere")) event.preventDefault()
  })
}

describe("soundness oracle", () => {
  it("every real three class requested at runtime is in the narrowed catalogue", async () => {
    const { Canvas } = await import("solid-three")
    const { Scene } = await import("./scene.fixture.tsx")

    requestedKeys.clear()
    const { unmount } = render(() => (
      <Canvas>
        <Scene />
      </Canvas>
    ))
    // Let the scene graph mount so every <T.X> child is accessed.
    await new Promise<void>(resolve => setTimeout(resolve, 100))
    unmount()

    const narrowed = new Set((expected as Record<string, string[]>)[FIXTURE] ?? [])
    const realClassesRequested = [...requestedKeys].filter(k => k in THREE).sort()

    // SOUNDNESS: nothing the render actually used was narrowed away.
    const leaked = realClassesRequested.filter(k => !narrowed.has(k))
    expect(leaked).toEqual([])

    // Sanity: the render genuinely exercised the catalogue (guards a vacuous pass).
    expect(realClassesRequested).toEqual([...narrowed].sort())
  })
})
