import { type Accessor, type Element, createRoot, merge, onSettled } from "solid-js"
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
 * Waits for the Solid reactive graph to fully settle (sync and async chains).
 * Use in tests: call `await settled()` after triggering reactive state changes
 * before making assertions.
 *
 * IMPORTANT: Do NOT call inside a reactive computation (createMemo, createEffect, etc.)
 * as onSettled fires when the sync graph settles — calling it inside an async memo
 * can produce infinite awaits.
 */
export function settled(): Promise<void> {
  return new Promise<void>(resolve => onSettled(() => resolve()))
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
 * const testScene = await test(() => <Mesh />, { camera: { position: [0,0,5] } });
 * await testScene.waitTillNextFrame();
 * testScene.unmount();
 */
export async function test(
  children: Accessor<Element>,
  props?: Omit<CanvasProps, "children">,
): Promise<TestApi> {
  const canvas = createTestCanvas()
  let context: ReturnType<typeof createThree> = null!
  let unmount: () => void = null!

  await new Promise<void>(resolve => {
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
      // onSettled must be called BEFORE createThree so that the trackedEffect it creates
      // ends up at the TAIL of test_root._firstChild. When a trackedEffect re-runs,
      // Solid 2.x calls disposeChildren(node, false) which sets _nextSibling = null —
      // if the node is at the HEAD, that breaks the chain and prevents disposal of
      // all subsequent nodes (including those from createThree) on unmount.
      onSettled(() => resolve())
      context = createThree(
        canvas,
        merge(
          {
            get children() {
              return children()
            },
            camera: {
              position: [0, 0, 5] as [number, number, number],
            },
          },
          props ?? {},
        ),
      )
    })
  })

  const waitTillNextFrame = () =>
    new Promise<void>(resolve => {
      const cleanup = context.addFrameListener(() => (cleanup(), resolve()))
    })

  return merge(context, {
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

const createTestCanvas = ({ width = 1280, height = 800 } = {}) => {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  // Explicit CSS size so getBoundingClientRect returns the intended dimensions
  // (without it the canvas defaults to its CSS 300×150 box, which breaks
  // event-coord raycasting tests that compute NDC from offsetX/offsetY).
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  // Anchor in the DOM so DOM APIs (getBoundingClientRect, pointer events,
  // ResizeObserver) behave like a mounted element.
  document.body.appendChild(canvas)
  return canvas
}
