import { createResizeObserver } from "@solid-primitives/resize-observer"
import { onMount, type JSX, type ParentProps, type Ref } from "solid-js"
import {
  Camera,
  OrthographicCamera,
  PerspectiveCamera,
  Raycaster,
  Scene,
  WebGLRenderer,
  type WebGLRendererParameters,
} from "three"
import { createThree } from "./create-three.tsx"
import type { EventRaycaster } from "./raycasters.tsx"
import type { CanvasEventHandlers, Context, Props, ResolvedRenderer } from "./types.ts"

/**
 * Props for the Canvas component, which initializes the Three.js rendering context and acts as the root for your 3D scene.
 */
export interface CanvasProps extends ParentProps<Partial<CanvasEventHandlers>> {
  ref?: Ref<Context>
  class?: string
  /** Configuration for the camera used in the scene. */
  camera?: Partial<Props<PerspectiveCamera> | Props<OrthographicCamera>> | Camera
  /** Configuration for the Raycaster used for mouse and pointer events. */
  raycaster?: Partial<Props<EventRaycaster>> | EventRaycaster | Raycaster
  /** Element to render while the main content is loading asynchronously.  */
  fallback?: JSX.Element
  /** Toggles flat interpolation for texture filtering. */
  flat?: boolean
  /** Controls the rendering loop's operation mode. */
  frameloop?: "never" | "demand" | "always"
  /**
   * Renderer to render the scene with. Accepts:
   * - a properties object (instance-writable keys, applied to a default `WebGLRenderer`)
   * - a `[constructorParameters, properties]` tuple (split form — useful when you
   *   need WebGL-only constructor args like `antialias` that can't be set after
   *   construction)
   * - a factory returning a renderer (e.g. `canvas => new WebGPURenderer({ canvas })`)
   * - a renderer instance (`WebGLRenderer`, `WebGPURenderer`, or any custom)
   *
   * The accepted renderer type narrows when you declare it via the `Register`
   * module-augmentation interface — see {@link Register} in `types.ts`.
   */
  gl?:
    // Properties-only / tuple shorthand creates a default WebGLRenderer at
    // runtime. When `Register` narrows `ResolvedRenderer` away from WebGL,
    // these branches collapse to `never` so the user is forced into the
    // factory or instance form that actually matches their declared renderer.
    | (WebGLRenderer extends ResolvedRenderer
        ?
            | Partial<Props<WebGLRenderer>>
            | readonly [
                constructorParameters: Partial<WebGLRendererParameters>,
                properties: Partial<Props<WebGLRenderer>>,
              ]
        : never)
    | ((canvas: HTMLCanvasElement) => ResolvedRenderer)
    | ResolvedRenderer
  /** Toggles linear interpolation for texture filtering. */
  linear?: boolean
  /** Toggles between Orthographic and Perspective camera. */
  orthographic?: boolean
  /** Configuration for the Scene instance. */
  scene?: Partial<Props<Scene>> | Scene
  /** Enables and configures shadows in the scene. */
  shadows?: boolean | "basic" | "percentage" | "soft" | "variance" | WebGLRenderer["shadowMap"]
  /** Custom CSS styles for the canvas container. */
  style?: JSX.CSSProperties
}

/**
 * Serves as the root component for all 3D scenes created with `solid-three`. It initializes
 * the Three.js rendering context, including a WebGL renderer, a scene, and a camera.
 * All `<T/>`-components must be children of this Canvas. Hooks such as `useThree` and
 * `useFrame` should only be used within this component to ensure proper context.
 *
 * @function Canvas
 * @param props - Configuration options include camera settings, style, and children elements.
 * @returns A div element containing the WebGL canvas configured to occupy the full available space.
 */
export function Canvas(props: ParentProps<CanvasProps>) {
  let canvas: HTMLCanvasElement = null!
  let container: HTMLDivElement = null!

  onMount(() => {
    const context = createThree(canvas, props)

    // Resize observer for the canvas to adjust camera and renderer on size change
    createResizeObserver(container, function onResize() {
      const { width, height } = container.getBoundingClientRect()
      context.gl.setSize(width, height)
      // DOM-based renderers (CSS2D/3D, SVG) don't have a pixel-ratio knob.
      context.gl.setPixelRatio?.(globalThis.devicePixelRatio)

      if (context.camera instanceof OrthographicCamera) {
        context.camera.left = width / -2
        context.camera.right = width / 2
        context.camera.top = height / 2
        context.camera.bottom = height / -2
      } else {
        context.camera.aspect = width / height
      }

      context.camera.updateProjectionMatrix()
      context.render(performance.now())
    })
  })

  return (
    <div
      ref={container!}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        contain: "strict",
        display: "flex",
        ...props.style,
      }}
      class={props.class}
    >
      <canvas ref={canvas!} />
    </div>
  )
}
