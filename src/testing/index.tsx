import { type Accessor, type JSX, createRoot, merge, onSettled } from "solid-js"
import type { CanvasProps } from "../canvas.tsx"
import { createThree } from "../create-three.tsx"
import { useRef } from "../utils.ts"
import { WebGL2RenderingContext } from "./webgl2-rendering-context.ts"

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
 * Initializes a testing enviromnent for `solid-three`.
 *
 * @param children - An accessor for the `AugmentedElement` to render.
 * @param [props] - Optional properties to configure canvas.
 * @returns `S3.Context` augmented with methods to unmount the scene and to wait for the next animation frame.
 *
 * @example
 * const testScene = test(() => <Mesh />, { camera: position: [0,0,5] });
 * await testScene.waitTillNextFrame();
 * testScene.unmount();
 */
export async function test(
  children: Accessor<JSX.Element>,
  props?: Omit<CanvasProps, "children">,
): Promise<TestApi> {
  const canvas = createTestCanvas()
  let context: ReturnType<typeof createThree> = null!
  let unmount: () => void = null!

  await new Promise<void>(resolve => {
    createRoot(dispose => {
      unmount = dispose
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
            defaultCamera: {
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
 * Canvas element tailored for testing.
 *
 * @param props
 * @returns The canvas JSX element.
 *
 * @example
 * render(<TestCanvas camera={{ position: [0,0,5] }} />);
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
 * Creates a mock canvas element for testing purposes. This function dynamically generates a canvas,
 * suitable for environments with or without a standard DOM. In non-DOM environments, it simulates
 * essential canvas properties and methods, including WebGL contexts.
 *
 * @param [options] - Configuration options for the canvas.
 * @returns A canvas element with specified dimensions and stubbed if necessary.
 *
 * @example
 * // Create a test canvas of default size
 * const canvas = createTestCanvas();
 *
 * @example
 * // Create a test canvas with custom dimensions
 * const customCanvas = createTestCanvas({ width: 1024, height: 768 });
 */
const createTestCanvas = ({ width = 1280, height = 800 } = {}) => {
  let canvas: HTMLCanvasElement

  if (typeof document !== "undefined" && typeof document.createElement === "function") {
    canvas = document.createElement("canvas")
  } else {
    canvas = {
      style: {},
      addEventListener: (() => {}) as any,
      removeEventListener: (() => {}) as any,
      clientWidth: width,
      clientHeight: height,
      getContext: (() => new WebGL2RenderingContext(canvas)) as any,
    } as HTMLCanvasElement
  }
  canvas.width = width
  canvas.height = height

  // JSDOM's getBoundingClientRect always returns zeros, which breaks the raycaster.
  // Override it to return the canvas's logical dimensions.
  canvas.getBoundingClientRect = () =>
    ({ width, height, top: 0, left: 0, right: width, bottom: height, x: 0, y: 0 }) as DOMRect

  // eslint-disable-next-line
  if (globalThis.HTMLCanvasElement) {
    const getContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, id: string) {
      if (id.startsWith("webgl")) {
        return new WebGL2RenderingContext(this)
      }
      return getContext.apply(this, arguments as any)
    } as any
  }

  class WebGLRenderingContext extends WebGL2RenderingContext {}
  // @ts-expect-error
  // eslint-disable-next-line
  globalThis.WebGLRenderingContext ??= WebGLRenderingContext
  // @ts-expect-error
  // eslint-disable-next-line
  globalThis.WebGL2RenderingContext ??= WebGL2RenderingContext

  return canvas
}
