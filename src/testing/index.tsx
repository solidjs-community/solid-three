import { Accessor, JSX, createRenderEffect, createRoot, mergeProps } from "solid-js";

import { CanvasProps } from "../canvas";
import { createThree } from "../create-three";
import { WebGL2RenderingContext } from "./webgl2-rendering-context";

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
export function test(
  children: Accessor<JSX.Element>,
  props?: Omit<CanvasProps, "children">,
): TestApi {
  const canvas = createTestCanvas();
  let context: ReturnType<typeof createThree> = null!;
  let unmount: () => void = null!;

  createRoot(dispose => {
    unmount = dispose;
    context = createThree(
      canvas,
      mergeProps(
        {
          get children() {
            return children();
          },
          camera: {
            position: [0, 0, 5] as [number, number, number],
          },
        },
        props,
      ),
    );
  });

  const waitTillNextFrame = () =>
    new Promise<void>(resolve => {
      const cleanup = context.addFrameListener(() => (cleanup(), resolve()));
    });

  return mergeProps(context, {
    unmount,
    waitTillNextFrame,
  });
}
type TestApi = ReturnType<typeof createThree> & {
  unmount: () => void;
  waitTillNextFrame: () => Promise<void>;
};

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
  const canvas = createTestCanvas();
  const container = (
    <div style={{ width: "100%", height: "100%" }}>{canvas}</div>
  ) as HTMLDivElement;

  createRoot(() => createThree(canvas, props));
  /* Assign ref */
  createRenderEffect(() => {
    if (props.ref instanceof Function) props.ref(container);
    else props.ref = container;
  });

  return container;
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
  let canvas: HTMLCanvasElement;

  if (typeof document !== "undefined" && typeof document.createElement === "function") {
    canvas = document.createElement("canvas");
  } else {
    canvas = {
      style: {},
      addEventListener: (() => {}) as any,
      removeEventListener: (() => {}) as any,
      clientWidth: width,
      clientHeight: height,
      getContext: (() => new WebGL2RenderingContext(canvas)) as any,
    } as HTMLCanvasElement;
  }
  canvas.width = width;
  canvas.height = height;

  if (globalThis.HTMLCanvasElement) {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, id: string) {
      if (id.startsWith("webgl")) return new WebGL2RenderingContext(this);
      return getContext.apply(this, arguments as any);
    } as any;
  }

  class WebGLRenderingContext extends WebGL2RenderingContext {}
  // @ts-expect-error
  globalThis.WebGLRenderingContext ??= WebGLRenderingContext;
  // @ts-expect-error
  globalThis.WebGL2RenderingContext ??= WebGL2RenderingContext;

  return canvas;
};
