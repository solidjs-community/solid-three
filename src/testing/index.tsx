import { type Accessor, type JSX, createRoot, mergeProps } from "solid-js"
import type { CanvasProps } from "../canvas.tsx"
import { createThree } from "../create-three.tsx"
import { useRef } from "../utils.ts"

const activeUnmounts = new Set<() => void>()

/**
 * Unmounts every active `test()` instance — disposes its Solid root, frees
 * its WebGL context, and removes its canvas from the DOM. Browsers cap
 * concurrent WebGL contexts (~16 in Chromium), so tests that don't clean up
 * exhaust the limit and the page crashes. Wire this into `afterEach` in your
 * test setup file.
 */
export function cleanup() {
  for (const unmount of activeUnmounts) unmount()
  activeUnmounts.clear()
}

/**
 * Initializes a testing environment for `solid-three`. Designed to run in a
 * real browser (e.g. vitest browser mode). jsdom is not supported.
 *
 * @param children - An accessor for the `AugmentedElement` to render.
 * @param [props] - Optional properties to configure canvas.
 * @returns `S3.Context` augmented with methods to unmount the scene and to wait for the next animation frame.
 *
 * @example
 * const testScene = test(() => <Mesh />, { camera: { position: [0,0,5] } });
 * await testScene.waitTillNextFrame();
 * testScene.unmount();
 */
export function test(
  children: Accessor<JSX.Element>,
  props?: Omit<CanvasProps, "children">,
): TestApi {
  const canvas = createTestCanvas()
  let context: ReturnType<typeof createThree> = null!
  let unmount: () => void = null!

  createRoot(dispose => {
    unmount = () => {
      activeUnmounts.delete(unmount)
      dispose()
      // Actively free the GPU context — Solid's dispose alone doesn't, and
      // browsers cap concurrent WebGL contexts.
      const gl = context.gl as { dispose?: () => void; forceContextLoss?: () => void }
      gl.dispose?.()
      gl.forceContextLoss?.()
      canvas.remove()
    }
    activeUnmounts.add(unmount)
    context = createThree(
      canvas,
      mergeProps(
        {
          get children() {
            return children()
          },
          camera: {
            position: [0, 0, 5] as [number, number, number],
          },
        },
        props,
      ),
    )
  })

  const waitTillNextFrame = () =>
    new Promise<void>(resolve => {
      const cleanup = context.addFrameListener(() => (cleanup(), resolve()))
    })

  return mergeProps(context, {
    unmount,
    waitTillNextFrame,
  })
}
type TestApi = ReturnType<typeof createThree> & {
  unmount: () => void
  waitTillNextFrame: () => Promise<void>
}

/**
 * Canvas element tailored for testing in a real browser.
 *
 * @example
 * render(() => <TestCanvas camera={{ position: [0,0,5] }} />);
 */
export function TestCanvas(props: CanvasProps) {
  const canvas = createTestCanvas()
  const container = (
    <div style={{ width: "100%", height: "100%" }}>{canvas}</div>
  ) as HTMLDivElement

  const three = createRoot(() => createThree(canvas, props))
  useRef(props, three)

  return container
}

/**
 * Creates a canvas, mounts it to `document.body`, and returns it. Mounting
 * is required so the canvas has real layout (`getBoundingClientRect` returns
 * non-zero rects), real `WebGL2RenderingContext`, and is reachable by
 * dispatched DOM events.
 */
const createTestCanvas = ({ width = 1280, height = 800 } = {}) => {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  document.body.appendChild(canvas)
  return canvas
}
