import {
  createEffect,
  getOwner,
  runWithOwner,
  type JSX,
  type ParentProps,
  type Ref,
} from "solid-js"
import {
  Camera,
  OrthographicCamera,
  PerspectiveCamera,
  Raycaster,
  Scene,
  WebGLRenderer,
} from "three"
import { SHOULD_DEBUG } from "./constants.ts"
import { createThree } from "./create-three.tsx"
import type { EventRaycaster } from "./raycasters.tsx"
import type { CanvasEventHandlers, Context, Props } from "./types.ts"
import { createDebug, createResizeObserver, describeOwnerChain } from "./utils.ts"

const debug = createDebug("canvas:Canvas", SHOULD_DEBUG)

/**
 * Props for the Canvas component, which initializes the Three.js rendering context and acts as the root for your 3D scene.
 */
export interface CanvasProps extends ParentProps<Partial<CanvasEventHandlers>> {
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
export function Canvas(props: ParentProps<CanvasProps>) {
  debug("mount", { ownerChain: describeOwnerChain() })

  const owner = getOwner()
  let canvas: HTMLCanvasElement = null!
  let container: HTMLDivElement = null!

  createEffect(
    () => {},
    () => {
      runWithOwner(owner, () => {
        const context = createThree(canvas, props)

        createResizeObserver(container, function onResize() {
          const { width, height } = container.getBoundingClientRect()
          const cameraKind =
            context.camera instanceof OrthographicCamera ? "orthographic" : "perspective"
          debug("resize", { width, height, camera: cameraKind })

          context.gl.setSize(width, height)
          context.gl.setPixelRatio(globalThis.devicePixelRatio)

          if (context.camera instanceof OrthographicCamera) {
            debug("resize", { camera: "orthographic", width, height })

            context.camera.left = width / -2
            context.camera.right = width / 2
            context.camera.top = height / 2
            context.camera.bottom = height / -2
          } else {
            debug("resize", { camera: "perspective", aspect: width / height })
            
            context.camera.aspect = width / height
          }

          context.camera.updateProjectionMatrix()
          context.render(performance.now())
        })
      })
    },
  )

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
