import { createResizeObserver } from "@solid-primitives/resize-observer"
import { onMount, type JSX, type ParentProps } from "solid-js"
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
import type {
  BaseProps,
  CanvasEventHandlers,
  Context,
  RefWithCleanup,
  ResolvedRenderer,
} from "./types.ts"

/**
 * Props for the Canvas component, which initializes the Three.js rendering context and acts as the root for your 3D scene.
 */
export interface CanvasProps extends ParentProps<Partial<CanvasEventHandlers>> {
  ref?: RefWithCleanup<Context>
  class?: string
  /** Configuration for the camera used in the scene. */
  camera?: Partial<BaseProps<PerspectiveCamera> | BaseProps<OrthographicCamera>> | Camera
  /** Configuration for the Raycaster used for mouse and pointer events. */
  raycaster?: Partial<BaseProps<EventRaycaster>> | EventRaycaster | Raycaster
  /** Element to render while the main content is loading asynchronously.  */
  fallback?: JSX.Element
  /** Toggles flat interpolation for texture filtering. */
  flat?: boolean
  /** Controls the rendering loop's operation mode. */
  frameloop?: "never" | "demand" | "always"
  /**
   * Renderer to render the scene with. Accepts:
   * - a flat properties object mixing `WebGLRendererParameters` (e.g. `antialias`,
   *   `alpha`, `powerPreference`) and instance-writable props (e.g. `toneMapping`).
   *   Constructor args are baked at first construction; instance props stay reactive.
   *   Reactively changing a constructor-only key logs a warning — WebGL contexts are
   *   immutable once created, so to swap config at runtime, unmount and remount
   *   `<Canvas>`.
   * - a factory returning a renderer (e.g. `canvas => new WebGPURenderer({ canvas })`)
   * - a renderer instance (`WebGLRenderer`, `WebGPURenderer`, or any custom)
   *
   * The accepted renderer type narrows when you declare it via the `Register`
   * module-augmentation interface — see {@link Register} in `types.ts`.
   */
  gl?: // Flat object accepts both `WebGLRendererParameters` (constructor-only,
    // e.g. `antialias`, `alpha`) and writable instance props (e.g.
    // `toneMapping`). solid-three splits them at construction: constructor args
    // are baked once; instance props stay reactive. Inspired by r3f's `gl` prop.
    // When `Register` narrows `ResolvedRenderer` away from WebGL this branch
    // collapses to `never` so the user is forced into the factory or instance
    // form that matches their declared renderer.
    | (WebGLRenderer extends ResolvedRenderer
        ? Partial<BaseProps<WebGLRenderer> & WebGLRendererParameters>
        : never)
    | ((canvas: HTMLCanvasElement) => ResolvedRenderer)
    | ResolvedRenderer
  /** Toggles linear interpolation for texture filtering. */
  linear?: boolean
  /** Toggles between Orthographic and Perspective camera. */
  orthographic?: boolean
  /** Configuration for the Scene instance. */
  scene?: Partial<BaseProps<Scene>> | Scene
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
  let canvas: HTMLCanvasElement | undefined
  let container: HTMLDivElement | undefined

  onMount(() => {
    if (!canvas || !container) return
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
      // While an XR session owns the frame loop, don't issue a window-driven
      // render — the session drives frames. The post-XR repaint happens on
      // sessionend.
      if (!context.gl?.xr?.isPresenting) context.render(performance.now())
    })
  })

  return (
    <div
      ref={container}
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
      <canvas ref={canvas} />
    </div>
  )
}
