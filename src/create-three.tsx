import {
  children,
  createEffect,
  createMemo,
  createRenderEffect,
  createRoot,
  merge,
  onCleanup,
} from "solid-js"
import {
  ACESFilmicToneMapping,
  BasicShadowMap,
  Camera,
  Clock,
  NoToneMapping,
  OrthographicCamera,
  PCFShadowMap,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector3,
  VSMShadowMap,
  WebGLRenderer,
} from "three"
import type { CanvasProps } from "./canvas.tsx"
import { createEvents } from "./create-events.ts"
import { Stack } from "./data-structure/stack.ts"
import { frameContext, threeContext } from "./hooks.ts"
import { eventContext } from "./internal-context.ts"
import { useProps, useSceneGraph } from "./props.ts"
import { CursorRaycaster, type EventRaycaster } from "./raycasters.tsx"
import type { CameraKind, Context, FrameListener, FrameListenerCallback } from "./types.ts"
import {
  binarySearch,
  defaultProps,
  getCurrentViewport,
  meta,
  removeElementFromArray,
  useRef,
  withMultiContexts,
} from "./utils.ts"
import { useMeasure } from "./utils/use-measure.ts"

/**
 * Creates and manages a `solid-three` scene. It initializes necessary objects like
 * camera, renderer, raycaster, and scene, manages the scene graph, setups up an event system
 * and rendering loop based on the provided properties.
 */
export function createThree(canvas: HTMLCanvasElement, props: CanvasProps) {
  const canvasProps = defaultProps(props, { frameloop: "always" })

  /**********************************************************************************/
  /*                                                                                */
  /*                                 Frame Listeners                                */
  /*                                                                                */
  /**********************************************************************************/

  const frameListeners = {
    before: {
      map: new Map<number, FrameListenerCallback[]>(),
      priorities: [] as number[], // Keep this sorted
    },
    after: {
      map: new Map<number, FrameListenerCallback[]>(),
      priorities: [] as number[],
    },
  }

  const addFrameListener: FrameListener = (callback, options) => {
    return createRoot(dispose => {
      createRenderEffect(
        () => {
          const { stage = "before", priority = 0 } = options ?? {}
          return { stage, priority }
        },
        ({ stage, priority }) => {
          const listeners = frameListeners[stage]

          let array = listeners.map.get(priority)

          if (!array) {
            array = []
            listeners.map.set(priority, array)
            const index = binarySearch(listeners.priorities, priority)
            listeners.priorities.splice(index, 0, priority)
          }

          array.push(callback)

          onCleanup(() => {
            removeElementFromArray(array, callback)
            if (array.length === 0) {
              listeners.map.delete(priority)
              listeners.priorities.splice(listeners.priorities.indexOf(priority), 1)
            }
          })
        },
      )

      return dispose
    })
  }

  function updateFrameListeners(stage: "before" | "after", delta: number, frame?: XRFrame) {
    for (const priority of frameListeners[stage].priorities) {
      const callbacks = frameListeners[stage].map.get(priority)!
      for (const callback of callbacks) {
        callback(context, delta, frame)
      }
    }
  }

  /**********************************************************************************/
  /*                                                                                */
  /*                                        XR                                      */
  /*                                                                                */
  /**********************************************************************************/

  // Handle frame behavior in WebXR
  const handleXRFrame: XRFrameRequestCallback = (timestamp: number, frame?: XRFrame) => {
    if ((canvasProps.frameloop as string) === "never") return
    render(timestamp, frame)
  }
  // Toggle render switching on session
  function handleSessionChange() {
    context.gl.xr.enabled = context.gl.xr.isPresenting
    context.gl.xr.setAnimationLoop(context.gl.xr.isPresenting ? handleXRFrame : null)
  }
  // WebXR session-manager
  const xr = {
    connect() {
      context.gl.xr.addEventListener("sessionstart", handleSessionChange)
      context.gl.xr.addEventListener("sessionend", handleSessionChange)
    },
    disconnect() {
      context.gl.xr.removeEventListener("sessionstart", handleSessionChange)
      context.gl.xr.removeEventListener("sessionend", handleSessionChange)
    },
  }

  /**********************************************************************************/
  /*                                                                                */
  /*                                     Render                                     */
  /*                                                                                */
  /**********************************************************************************/

  let pendingRenderRequest: number | undefined

  function render(timestamp: number, frame?: XRFrame) {
    if (!context.gl) {
      return
    }
    if (props.frameloop === "never") {
      context.clock.elapsedTime = timestamp
    }
    pendingRenderRequest = undefined

    const delta = context.clock.getDelta()
    updateFrameListeners("before", delta, frame)
    context.gl.render(context.scene, context.camera)
    updateFrameListeners("after", delta, frame)
  }
  function requestRender() {
    if (pendingRenderRequest) return
    pendingRenderRequest = requestAnimationFrame(render)
  }
  onCleanup(() => pendingRenderRequest && cancelAnimationFrame(pendingRenderRequest))

  /**********************************************************************************/
  /*                                                                                */
  /*                                  Three Context                                 */
  /*                                                                                */
  /**********************************************************************************/

  const defaultCamera = createMemo(() =>
    meta(
      props.defaultCamera instanceof Camera
        ? (props.defaultCamera as OrthographicCamera | PerspectiveCamera)
        : props.orthographic
        ? new OrthographicCamera()
        : new PerspectiveCamera(),
      {
        get props() {
          return props.defaultCamera || {}
        },
      },
    ),
  )
  const cameraStack = new Stack<CameraKind>("camera")

  const scene = createMemo(() =>
    meta(props.scene instanceof Scene ? props.scene : new Scene(), {
      get props() {
        return props.scene || {}
      },
    }),
  )

  const defaultRaycaster = createMemo(() =>
    meta<Raycaster | EventRaycaster>(
      props.defaultRaycaster instanceof Raycaster ? props.defaultRaycaster : new CursorRaycaster(),
      {
        get props() {
          return props.defaultRaycaster || {}
        },
      },
    ),
  )

  const raycasterStack = new Stack<Raycaster>("raycaster")

  const gl = createMemo(() => {
    const gl =
      props.gl instanceof WebGLRenderer
        ? // props.gl can be a WebGLRenderer provided by the user
          props.gl
        : typeof props.gl === "function"
        ? // or a callback that returns a Renderer
          props.gl(canvas)
        : // if props.gl is not defined we default to a WebGLRenderer
          new WebGLRenderer({ canvas, alpha: true })

    return meta(gl, {
      get props() {
        return props.gl || {}
      },
    })
  })

  const measure = useMeasure()
  measure.setElement(canvas)

  const defaultTarget = new Vector3()
  const viewport = createMemo(() =>
    getCurrentViewport(defaultCamera(), defaultTarget, measure.bounds()),
  )

  const clock = new Clock()
  clock.start()

  const context: Context = {
    get bounds() {
      return measure.bounds()
    },
    canvas,
    clock,
    get dpr() {
      return this.gl.getPixelRatio()
    },
    props,
    render,
    requestRender,
    get viewport() {
      return viewport()
    },
    xr,
    // elements
    get camera() {
      return cameraStack.peek() ?? defaultCamera()
    },
    setCamera(camera: CameraKind) {
      return cameraStack.push(camera)
    },
    get scene() {
      return scene()
    },
    get raycaster() {
      return raycasterStack.peek() || defaultRaycaster()
    },
    setRaycaster(raycaster: Raycaster) {
      return raycasterStack.push(raycaster)
    },
    get gl() {
      return gl()
    },
  }

  withMultiContexts(
    () => useRef(props, context),
    [
      [threeContext, context],
      [frameContext, addFrameListener],
    ],
  )

  /**********************************************************************************/
  /*                                                                                */
  /*                                     Effects                                    */
  /*                                                                                */
  /**********************************************************************************/

  withMultiContexts(() => {
    createRenderEffect(
      () => props.frameloop,
      frameloop => {
        if (frameloop === "never") {
          context.clock.stop()
          context.clock.elapsedTime = 0
        } else {
          context.clock.start()
        }
      },
    )

    // Manage camera
    createRenderEffect(
      () => ({
        peek: cameraStack.peek(),
        defaultCamera: props.defaultCamera,
      }),
      ({ peek, defaultCamera: dc }) => {
        if (peek) return
        if (!dc || dc instanceof Camera) return
        useProps(defaultCamera, dc)
        // NOTE:  Manually update camera's matrix with updateMatrixWorld is needed.
        //        Otherwise casting a ray immediately after start-up will cause the incorrect matrix to be used.
        defaultCamera().updateMatrixWorld(true)
      },
    )

    // Manage scene
    createRenderEffect(
      () => props.scene,
      scene_ => {
        if (!scene_ || scene_ instanceof Scene) return
        useProps(scene, scene_)
      },
    )

    // Manage raycaster
    createRenderEffect(
      () => props.defaultRaycaster,
      raycaster => {
        if (!raycaster || raycaster instanceof Raycaster) return
        useProps(defaultRaycaster, raycaster)
      },
    )

    // Manage gl
    createRenderEffect(
      () => {
        // Shadow map — child created in compute phase ✓
        createRenderEffect(
          () => ({
            enabled: !!props.shadows,
            type:
              typeof props.shadows === "string"
                ? ({ basic: BasicShadowMap, percentage: PCFShadowMap, soft: PCFSoftShadowMap, variance: VSMShadowMap } as const)[props.shadows] ?? PCFSoftShadowMap
                : PCFSoftShadowMap,
            shadowsObj: typeof props.shadows === "object" ? props.shadows : undefined,
            gl: gl(),
          }),
          ({ enabled, type, shadowsObj, gl: _gl }) => {
            if (!_gl.shadowMap) return
            const changed = _gl.shadowMap.enabled !== enabled || _gl.shadowMap.type !== type
            _gl.shadowMap.enabled = enabled
            if (shadowsObj) {
              Object.assign(_gl.shadowMap, shadowsObj)
            } else {
              _gl.shadowMap.type = type
            }
            if (changed) _gl.shadowMap.needsUpdate = true
          },
        )

        // XR connect — intentionally createEffect (DOM side effect, not render phase) ✓
        createEffect(
          () => gl(),
          renderer => {
            if (renderer.xr) context.xr.connect()
          },
        )

        // Color space and tone mapping
        const LinearEncoding = 3000
        const sRGBEncoding = 3001
        useProps(gl, {
          get outputEncoding() {
            return props.linear ? LinearEncoding : sRGBEncoding
          },
          get toneMapping() {
            return props.flat ? NoToneMapping : ACESFilmicToneMapping
          },
        })

        // User-supplied gl options object (must not drop this — handles props.gl={antialias:true} etc.)
        if (props.gl && !(props.gl instanceof WebGLRenderer)) {
          useProps(gl, props.gl)
        }
      },
      () => {},
    )
  }, [[threeContext, context]])

  /**********************************************************************************/
  /*                                                                                */
  /*                                   Render Loop                                  */
  /*                                                                                */
  /**********************************************************************************/

  let pendingLoopRequest: number | undefined
  function loop(value: number) {
    pendingLoopRequest = requestAnimationFrame(loop)
    context.render(value)
  }
  createRenderEffect(
    () => canvasProps.frameloop,
    frameloop => {
      if (frameloop === "always") {
        pendingLoopRequest = requestAnimationFrame(loop)
      }
      onCleanup(() => pendingLoopRequest && cancelAnimationFrame(pendingLoopRequest))
    },
  )

  /**********************************************************************************/
  /*                                                                                */
  /*                                     Events                                     */
  /*                                                                                */
  /**********************************************************************************/

  // Initialize event-system
  const { addEventListener } = createEvents(context)

  /**********************************************************************************/
  /*                                                                                */
  /*                                   Scene Graph                                  */
  /*                                                                                */
  /**********************************************************************************/

  const EventContext = eventContext
  const FrameContext = frameContext
  const ThreeContext = threeContext
  const c = children(() => (
    <EventContext value={addEventListener}>
      <FrameContext value={addFrameListener}>
        <ThreeContext value={context}>{canvasProps.children}</ThreeContext>
      </FrameContext>
    </EventContext>
  ))

  useSceneGraph(
    context.scene,
    merge(props, {
      get children() {
        return c()
      },
    }),
  )

  // Return context merged with `addFrameListeners``
  // This is used in `@solid-three/testing`
  return merge(context, { addFrameListener })
}
