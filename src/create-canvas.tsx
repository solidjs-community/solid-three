import { createResizeObserver } from "@solid-primitives/resize-observer"
import { onMount, type JSX, type ParentProps, type Ref } from "solid-js"
import {
  Camera,
  OrthographicCamera,
  PerspectiveCamera,
  Raycaster,
  Scene,
  WebGLRenderer,
} from "three"
import { createThree } from "./create-three.tsx"
import type { EventRaycaster } from "./raycasters.tsx"
import type { Context, InferPluginProps, Plugin, Props } from "./types.ts"

/**
 * Props for the Canvas component, which initializes the Three.js rendering context and acts as the root for your 3D scene.
 */
export interface CanvasProps extends ParentProps {
  ref?: Ref<Context>
  class?: string
  /** Configuration for the camera used in the scene. */
  defaultCamera?: Partial<Props<PerspectiveCamera> | Props<OrthographicCamera>> | Camera
  /** Configuration for the Raycaster used for mouse and pointer events. */
  defaultRaycaster?: Partial<Props<EventRaycaster>> | EventRaycaster | Raycaster
  /** Element to render while the main content is loading asynchronously.  */
  fallback?: JSX.Element
  /** Toggles flat interpolation for texture filtering. */
  flat?: boolean
  /** Controls the rendering loop's operation mode. */
  frameloop?: "never" | "demand" | "always"
  /** Options for the WebGLRenderer or a function returning a customized renderer. */
  gl?:
    | Partial<Props<WebGLRenderer>>
    | ((canvas: HTMLCanvasElement) => WebGLRenderer)
    | WebGLRenderer
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
export function createCanvas<TPlugins extends Plugin[] = Plugin[]>(plugins: TPlugins) {
  return function (props: ParentProps<CanvasProps> & Partial<InferPluginProps<Scene, TPlugins>>) {
    let canvas: HTMLCanvasElement = null!
    let container: HTMLDivElement = null!

    onMount(() => {
      const context = createThree(canvas, props, plugins)

      // Resize observer for the canvas to adjust camera and renderer on size change
      createResizeObserver(container, function onResize() {
        const { width, height } = container.getBoundingClientRect()
        context.gl.setSize(width, height)
        context.gl.setPixelRatio(globalThis.devicePixelRatio)

        if (context.currentCamera instanceof OrthographicCamera) {
          context.currentCamera.left = width / -2
          context.currentCamera.right = width / 2
          context.currentCamera.top = height / 2
          context.currentCamera.bottom = height / -2
        } else {
          context.currentCamera.aspect = width / height
        }

        context.currentCamera.updateProjectionMatrix()
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
}
