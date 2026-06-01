import { render } from "@solidjs/testing-library"
import * as THREE from "three"
import { afterEach, beforeAll, expect, test, vi } from "vitest"
import oracle from "./oracle.generated.json"
import { requestedKeys, wrap } from "./shim"

// Route solid-three's `createT` through the instrumentation shim, so every
// catalogue key the running scene accesses is recorded into `requestedKeys`.
// `importOriginal` gives us the real factory to wrap (not a recursion).
vi.mock("solid-three", async importOriginal => {
  const real = await importOriginal<typeof import("solid-three")>()
  return { ...real, createT: wrap(real.createT) }
})

// `Canvas` and `Scene` must come from the SAME mocked module graph so they
// share one reconciler context; importing a second harness bundle yields
// "hooks called outside <Canvas>".
import { Canvas } from "solid-three"
import { Scene } from "./scene.fixture"

beforeAll(() => {
  // A render-loop raycast may throw asynchronously about a missing
  // boundingSphere after our synchronous assertion has already run. That race
  // is unrelated to soundness; swallow exactly that error.
  window.addEventListener("error", e => {
    if (e.message?.includes("boundingSphere")) e.preventDefault()
  })
})

afterEach(() => {
  requestedKeys.clear()
})

test("soundness oracle: every runtime-accessed catalogue key survives narrowing", async () => {
  render(() => (
    <Canvas>
      <Scene />
    </Canvas>
  ))

  // Let the scene graph mount.
  await new Promise(resolve => setTimeout(resolve, 100))

  const narrowed = new Set<string>(oracle.keys)
  // Only consider keys that are genuine THREE classes (the proxy also sees
  // framework/internal property probes that are not catalogue classes).
  const requested = [...requestedKeys].filter(key => key in THREE)

  // Non-vacuous: the scene must actually have exercised some catalogue classes.
  expect(requested.length).toBeGreaterThan(0)

  // Soundness: narrowing must never drop a class the running scene uses.
  const leaked = requested.filter(key => !narrowed.has(key))
  expect(leaked).toEqual([])
})
