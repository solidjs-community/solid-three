/**
 * Does the PUBLISHED package actually WORK at runtime, across subpath exports?
 *
 * This is the runtime twin of `consumer/across-subpaths.tsx` (the type fixture), and it
 * exists for the same reason: every other test in this repo imports from `src/`, which is
 * ONE module graph by construction, so no test could ever see a defect that only appears
 * once the code has been split into shipped bundles.
 *
 * A real one shipped. `tsup` built each entry point as its own standalone bundle, so
 * `dist/events.js` inlined a SECOND COPY of core — including `src/constants.ts`'s
 * `$S3C = Symbol("solid-three")`. Core's `meta()` (out of `dist/index.js`) branded objects
 * with copy A's `$S3C`; the engine's `getMeta()` (out of `dist/events.js`) looked up copy
 * B's, read `undefined`, and `register()` early-returned. The engine's registry stayed
 * empty and POINTER EVENTS SILENTLY NEVER FIRED for anyone consuming the package. The
 * whole suite stayed green throughout. The exact same duplication also gave each bundle a
 * private `engines` WeakMap, so a shared brand alone would not have saved it — the modules
 * themselves have to be shared. See `tsup.config.ts`.
 *
 * So: no `src/` import and no path alias below. `solid-three` and `solid-three/events`
 * resolve the way they resolve for a dependent — through this package's `exports` map,
 * onto the BUILT files in `dist/`. (`node_modules/solid-three` is a self-link back to the
 * repo root; see the `solid-three` devDependency.) It follows that this test needs
 * `pnpm build` to have run: `pnpm test:published` does that for you.
 *
 * Keep the assertion behavioural — a handler either fires or it doesn't. Asserting on the
 * shape of the bundles instead would just re-test the bundler.
 */
import { render } from "@solidjs/testing-library"
import { Canvas, createT } from "solid-three"
import { pointerEvents } from "solid-three/events"
import * as THREE from "three"
import { afterEach, describe, expect, it, vi } from "vitest"

/** The canvas the click coordinates below assume. Mirrors the `test()` harness's default. */
const CANVAS_WIDTH = 1280
const CANVAS_HEIGHT = 800

const pointerEventsPlugin = pointerEvents()
const T = createT(THREE, [pointerEventsPlugin])

const hosts: HTMLDivElement[] = []

afterEach(() => {
  for (const host of hosts) host.remove()
  hosts.length = 0
})

/**
 * `<Canvas>` fills its parent, so the parent is what fixes the canvas's size and position.
 * Pinned to the viewport's top-left so `clientX`/`clientY` and the canvas's `offsetX`/
 * `offsetY` (what the engine turns into NDC) are the same numbers.
 */
function createHost() {
  const host = document.createElement("div")
  host.style.position = "fixed"
  host.style.top = "0px"
  host.style.left = "0px"
  host.style.width = `${CANVAS_WIDTH}px`
  host.style.height = `${CANVAS_HEIGHT}px`
  document.body.appendChild(host)
  hosts.push(host)
  return host
}

const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()))

/**
 * `<Canvas>` sizes its canvas from a `ResizeObserver`, so the canvas is 0×0 for the first
 * few frames after mount and a click dispatched then maps to a garbage ray. Wait for the
 * size the click coordinates assume, then give the scene one more frame to render.
 */
async function waitForSizedCanvas(host: HTMLDivElement): Promise<HTMLCanvasElement> {
  for (let attempt = 0; attempt < 300; attempt++) {
    const canvas = host.querySelector("canvas")
    if (canvas) {
      const bounds = canvas.getBoundingClientRect()
      if (bounds.width === CANVAS_WIDTH && bounds.height === CANVAS_HEIGHT) {
        await nextFrame()
        return canvas
      }
    }
    await nextFrame()
  }
  throw new Error("<Canvas> never sized its canvas — the test cannot aim a click at it.")
}

describe("the built package, resolved through its exports map", () => {
  it("fires a mesh's onClick — core and the engine share one copy of core's module state", async () => {
    const handleClick = vi.fn()
    const host = createHost()

    render(
      () => (
        <Canvas plugins={[pointerEventsPlugin]} camera={{ position: [0, 0, 5] }}>
          <T.Mesh onClick={handleClick}>
            <T.BoxGeometry args={[2, 2]} />
            <T.MeshBasicMaterial />
          </T.Mesh>
        </Canvas>
      ),
      { container: host },
    )

    const canvas = await waitForSizedCanvas(host)

    // Straight at the centre, where the 2×2 box sits with the camera at z=5.
    canvas.dispatchEvent(
      new MouseEvent("click", {
        clientX: CANVAS_WIDTH / 2,
        clientY: CANVAS_HEIGHT / 2,
        bubbles: true,
      }),
    )

    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})
