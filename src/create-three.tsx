import {
  children,
  createEffect,
  createMemo,
  createRenderEffect,
  createRoot,
  mergeProps,
  onCleanup,
} from "solid-js"
import {
  ACESFilmicToneMapping,
  BasicShadowMap,
  Camera,
  Clock,
  LinearSRGBColorSpace,
  NoToneMapping,
  OrthographicCamera,
  PCFShadowMap,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Raycaster,
  Scene,
  SRGBColorSpace,
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
import type {
  CameraKind,
  Context,
  FrameListener,
  FrameListenerCallback,
  Renderer,
} from "./types.ts"
import {
  binarySearch,
  defaultProps,
  getCurrentViewport,
  getPendingInit,
  isWebGLShadowMap,
  isWebXRManager,
  meta,
  removeElementFromArray,
  useRef,
  withMultiContexts,
} from "./utils.ts"
import { useMeasure } from "./utils/use-measure.ts"

/**
 * Returns true when `value` is an already-built renderer instance (anything
 * matching {@link Renderer}) rather than a config-props object or a factory.
 */
function isRendererInstance(value: unknown): value is Renderer {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Renderer).render === "function" &&
    typeof (value as Renderer).setSize === "function"
  )
}

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
      createRenderEffect(() => {
        const { stage = "before", priority = 0 } = options ?? {}

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
      })

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
    if (canvasProps.frameloop === "never") return
    render(timestamp, frame)
  }
  // XR session wiring is built for `WebXRManager` (WebGL build of three's
  // XR). WebGPURenderer ships a different `XRManager` class that handles
  // animation loops via the renderer itself — duck-typing on
  // `setAnimationLoop` cleanly excludes it without needing instanceof checks
  // (which would force runtime imports of the manager classes).
  function handleSessionChange() {
    const xrManager = context.gl.xr
    if (!isWebXRManager(xrManager)) return
    xrManager.enabled = xrManager.isPresenting
    xrManager.setAnimationLoop(xrManager.isPresenting ? handleXRFrame : null)
  }
  const xr = {
    connect() {
      const xrManager = context.gl.xr
      if (!isWebXRManager(xrManager)) return
      xrManager.addEventListener("sessionstart", handleSessionChange)
      xrManager.addEventListener("sessionend", handleSessionChange)
    },
    disconnect() {
      const xrManager = context.gl.xr
      if (!isWebXRManager(xrManager)) return
      xrManager.removeEventListener("sessionstart", handleSessionChange)
      xrManager.removeEventListener("sessionend", handleSessionChange)
    },
  }

  /**********************************************************************************/
  /*                                                                                */
  /*                                     Render                                     */
  /*                                                                                */
  /**********************************************************************************/

  let pendingRenderRequest: number | undefined
  // WebGPURenderer needs `await renderer.init()` before its first render. The
  // render loop spins harmlessly until this flips true.
  let glInitialized = false

  function render(timestamp: number, frame?: XRFrame) {
    if (!context.gl || !glInitialized) {
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

  const camera = createMemo(() =>
    meta(
      props.camera instanceof Camera
        ? (props.camera as OrthographicCamera | PerspectiveCamera)
        : props.orthographic
          ? new OrthographicCamera()
          : new PerspectiveCamera(),
      {
        get props() {
          return props.camera || {}
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

  const raycaster = createMemo(() =>
    meta<Raycaster | EventRaycaster>(
      props.raycaster instanceof Raycaster ? props.raycaster : new CursorRaycaster(),
      {
        get props() {
          return props.raycaster || {}
        },
      },
    ),
  )

  const raycasterStack = new Stack<Raycaster>("raycaster")

  const gl = createMemo(() => {
    const _gl: Renderer =
      typeof props.gl === "function"
        ? // factory callback that returns a renderer
          props.gl(canvas)
        : isRendererInstance(props.gl)
          ? // an already-built renderer instance (WebGLRenderer, WebGPURenderer, …)
            props.gl
          : // no renderer supplied (or a config-props object) → default WebGLRenderer
            new WebGLRenderer({ canvas, alpha: true })

    return meta(_gl, {
      get props() {
        return props.gl || {}
      },
    })
  })

  const measure = useMeasure()
  measure.setElement(canvas)

  const defaultTarget = new Vector3()
  const viewport = createMemo(() => getCurrentViewport(camera(), defaultTarget, measure.bounds()))

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
      return cameraStack.peek() ?? camera()
    },
    setCamera(camera: CameraKind) {
      return cameraStack.push(camera)
    },
    get scene() {
      return scene()
    },
    get raycaster() {
      return raycasterStack.peek() || raycaster()
    },
    setRaycaster(raycaster: Raycaster) {
      return raycasterStack.push(raycaster)
    },
    get gl() {
      return gl()
    },
  }

  /**********************************************************************************/
  /*                                                                                */
  /*                                     Effects                                    */
  /*                                                                                */
  /**********************************************************************************/

  withMultiContexts(() => {
    createRenderEffect(() => {
      if (props.frameloop === "never") {
        context.clock.stop()
        context.clock.elapsedTime = 0
      } else {
        context.clock.start()
      }
    })

    // Manage camera
    createRenderEffect(() => {
      if (cameraStack.peek()) return
      if (!props.camera || props.camera instanceof Camera) return
      useProps(camera, props.camera)
      // NOTE:  Manually update camera's matrix with updateMatrixWorld is needed.
      //        Otherwise casting a ray immediately after start-up will cause the incorrect matrix to be used.
      camera().updateMatrixWorld(true)
    })

    // Manage scene
    createRenderEffect(() => {
      if (!props.scene || props.scene instanceof Scene) return
      useProps(scene, props.scene)
    })

    // Manage raycaster
    createRenderEffect(() => {
      if (!props.raycaster || props.raycaster instanceof Raycaster) return
      useProps(raycaster, props.raycaster)
    })

    // Manage gl
    createRenderEffect(() => {
      // Set shadow-map. `enabled` and `type` exist on both WebGL/WebGPU
      // shadow maps; `needsUpdate` is WebGL-only, gated by isWebGLShadowMap.
      createRenderEffect(() => {
        const shadowMap = gl().shadowMap
        if (!shadowMap) return
        const oldEnabled = shadowMap.enabled
        const oldType = shadowMap.type
        shadowMap.enabled = !!props.shadows

        if (typeof props.shadows === "boolean") {
          shadowMap.type = PCFSoftShadowMap
        } else if (typeof props.shadows === "string") {
          const types = {
            basic: BasicShadowMap,
            percentage: PCFShadowMap,
            soft: PCFSoftShadowMap,
            variance: VSMShadowMap,
          }
          shadowMap.type = types[props.shadows] ?? PCFSoftShadowMap
        } else if (typeof props.shadows === "object") {
          Object.assign(shadowMap, props.shadows)
        }

        if (
          isWebGLShadowMap(shadowMap) &&
          (oldEnabled !== shadowMap.enabled || oldType !== shadowMap.type)
        ) {
          shadowMap.needsUpdate = true
        }
      })

      createEffect(() => {
        // Wire XR only when the active renderer exposes a `WebXRManager`-
        // shaped manager. Inner `xr.connect()`/`disconnect()` guards
        // reinforce this if `context.gl` swaps later.
        if (isWebXRManager(gl().xr)) context.xr.connect()
      })

      // Await async renderer init (WebGPURenderer requires this before the
      // first render). For WebGLRenderer this branch is a no-op and
      // `glInitialized` flips true synchronously.
      createEffect(async () => {
        const renderer = gl()
        glInitialized = false
        // Register synchronously so a renderer swap mid-init can abort.
        let cancelled = false
        onCleanup(() => {
          cancelled = true
        })

        const init = getPendingInit(renderer)
        if (init) {
          // Size the canvas backing buffer before init so WebGPU allocates the
          // depth attachment at the correct dimensions (otherwise the default
          // 300×150 causes a size mismatch on the first resize).
          const rect = canvas.getBoundingClientRect()
          const ratio = globalThis.devicePixelRatio || 1
          if (rect.width > 0 && rect.height > 0) {
            canvas.width = rect.width * ratio
            canvas.height = rect.height * ratio
          }
          await init()
        }

        if (!cancelled) glInitialized = true
      })

      // Color management and tone-mapping. Both WebGLRenderer and
      // WebGPURenderer expose `outputColorSpace` and `toneMapping`; we
      // structurally check so exotic renderers (SVGRenderer, custom) that
      // don't have them are skipped instead of crashing.
      const _gl = gl()
      if ("outputColorSpace" in _gl) {
        useProps(gl, {
          get outputColorSpace() {
            return props.linear ? LinearSRGBColorSpace : SRGBColorSpace
          },
        })
      }
      if ("toneMapping" in _gl) {
        useProps(gl, {
          get toneMapping() {
            return props.flat ? NoToneMapping : ACESFilmicToneMapping
          },
        })
      }

      // Apply props.gl as renderer config only when it's a plain config object
      // (i.e. not a factory or a renderer instance).
      if (props.gl && typeof props.gl !== "function" && !isRendererInstance(props.gl)) {
        useProps(gl, props.gl)
      }
    })
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
  createRenderEffect(() => {
    if (canvasProps.frameloop === "always") {
      pendingLoopRequest = requestAnimationFrame(loop)
    }
    onCleanup(() => pendingLoopRequest && cancelAnimationFrame(pendingLoopRequest))
  })

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

  const c = children(() => (
    <eventContext.Provider value={addEventListener}>
      <frameContext.Provider value={addFrameListener}>
        <threeContext.Provider value={context}>{canvasProps.children}</threeContext.Provider>
      </frameContext.Provider>
    </eventContext.Provider>
  ))

  useSceneGraph(
    context.scene,
    mergeProps(props, {
      get children() {
        return c()
      },
    }),
  )

  withMultiContexts(
    () => useRef(props, context),
    [
      [threeContext, context],
      [frameContext, addFrameListener],
    ],
  )

  // Return context merged with `addFrameListeners``
  // This is used in `@solid-three/testing`
  return mergeProps(context, { addFrameListener })
}
