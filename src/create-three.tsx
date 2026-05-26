import {
  children,
  createEffect,
  createMemo,
  createRenderEffect,
  createResource,
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
  type WebGLRendererParameters,
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
  Meta,
  Renderer,
} from "./types.ts"
import {
  binarySearch,
  defaultProps,
  getCurrentViewport,
  getPendingInit,
  isRenderer,
  isWebGLShadowMap,
  isWebXRManager,
  meta,
  removeElementFromArray,
  shallowEqual,
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
  function warnNonXR(method: string) {
    console.warn(
      `solid-three: ${method} is a no-op — the active renderer has no \`WebXRManager\`-shaped \`xr\` manager. Pass a WebGLRenderer (or a WebGPURenderer with three's XR layer) to enable XR.`,
    )
  }
  function handleSessionChange() {
    const xrManager = context.gl.xr
    if (!isWebXRManager(xrManager)) return
    xrManager.enabled = xrManager.isPresenting
    xrManager.setAnimationLoop(xrManager.isPresenting ? handleXRFrame : null)
  }
  const xr = {
    connect() {
      const xrManager = context.gl.xr
      if (!isWebXRManager(xrManager)) return warnNonXR("xr.connect()")
      xrManager.addEventListener("sessionstart", handleSessionChange)
      xrManager.addEventListener("sessionend", handleSessionChange)
    },
    disconnect() {
      const xrManager = context.gl.xr
      if (!isWebXRManager(xrManager)) return warnNonXR("xr.disconnect()")
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

  function render(timestamp: number, frame?: XRFrame) {
    // `WebGPURenderer.init()` must complete before the first render; the
    // render loop spins harmlessly until the resource flips to "ready".
    // WebGL renderers report ready synchronously on creation.
    if (!context.gl || rendererReady.state !== "ready") {
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

  // Construction firewall — only track inputs that actually decide WHICH
  // object to construct (instanceof checks, orthographic flag, gl kind).
  // The full prop config is read INSIDE the branch that needs it, so
  // reactive config-objects (e.g. `<Canvas camera={{ position: pos() }}>`)
  // whose contents change but whose "shape category" stays the same don't
  // re-run the construction memo. Post-construction updates flow through
  // the existing `useProps(…)` effects unchanged.
  //
  // The booleans/strings here are === comparable, so a fresh JSX getter
  // call producing the same kind doesn't propagate.
  const cameraIsInstance = createMemo(() => props.camera instanceof Camera)
  const orthographicFlag = createMemo(() => !!props.orthographic)
  const sceneIsInstance = createMemo(() => props.scene instanceof Scene)
  const raycasterIsInstance = createMemo(() => props.raycaster instanceof Raycaster)
  const glKind = createMemo<"factory" | "instance" | "default">(() => {
    const _propsGl = props.gl
    if (typeof _propsGl === "function") return "factory"
    if (isRenderer(_propsGl)) return "instance"
    return "default"
  })
  /**
   * Constructor arguments for the default WebGLRenderer branch. Tuple form
   * `gl={[ctorArgs, properties]}` puts them in slot 0; single-object form
   * implies empty ctor args. Firewalled by `shallowEqual` so a fresh-reference
   * same-content config (typical JSX getter behaviour) doesn't recreate.
   */
  const glConstructorArgs = createMemo<Partial<WebGLRendererParameters>>(
    () => {
      const _propsGl = props.gl
      return Array.isArray(_propsGl) ? _propsGl[0] : {}
    },
    {},
    { equals: shallowEqual },
  )

  const camera = createMemo(() => {
    if (cameraIsInstance()) {
      // Read props.camera reactively here so swapping instances at runtime works.
      return meta(props.camera as OrthographicCamera | PerspectiveCamera, {
        get props() {
          return props.camera || {}
        },
      })
    }
    // Config-object branch: don't read props.camera in the memo body — the
    // contents don't affect construction (they're applied via useProps later).
    return meta(
      orthographicFlag() ? new OrthographicCamera() : new PerspectiveCamera(),
      {
        get props() {
          return props.camera || {}
        },
      },
    )
  })
  const cameraStack = new Stack<CameraKind>("camera")

  const scene = createMemo(() => {
    if (sceneIsInstance()) {
      return meta(props.scene as Scene, {
        get props() {
          return props.scene || {}
        },
      })
    }
    return meta(new Scene(), {
      get props() {
        return props.scene || {}
      },
    })
  })

  const raycaster = createMemo(() => {
    if (raycasterIsInstance()) {
      return meta<Raycaster | EventRaycaster>(props.raycaster as Raycaster, {
        get props() {
          return props.raycaster || {}
        },
      })
    }
    return meta<Raycaster | EventRaycaster>(new CursorRaycaster(), {
      get props() {
        return props.raycaster || {}
      },
    })
  })

  const raycasterStack = new Stack<Raycaster>("raycaster")

  // Tracks whether the *previous* renderer was built by us (vs supplied by
  // the user via factory/instance). Only our own renderers get disposed when
  // the memo re-runs — disposing a user's renderer would be rude.
  let ownsCurrentRenderer = false
  const gl = createMemo<Meta<Renderer>>(previous => {
    if (previous && ownsCurrentRenderer) {
      const old = previous as unknown as WebGLRenderer
      old.dispose?.()
      if ("forceContextLoss" in old) old.forceContextLoss()
    }
    const kind = glKind()
    let _gl: Renderer
    if (kind === "factory") {
      _gl = (props.gl as (canvas: HTMLCanvasElement) => Renderer)(canvas)
      ownsCurrentRenderer = false
    } else if (kind === "instance") {
      _gl = props.gl as Renderer
      ownsCurrentRenderer = false
    } else {
      // Default branch — construct a WebGLRenderer with the user's ctor args
      // (if they passed a `[ctorArgs, props]` tuple). The default `alpha: true`
      // can be overridden by the user; `canvas` is solid-three's own and
      // intentionally placed last so it can't be.
      _gl = new WebGLRenderer({ alpha: true, ...glConstructorArgs(), canvas })
      ownsCurrentRenderer = true
    }

    return meta(_gl, {
      get props() {
        return props.gl || {}
      },
    })
  })

  /**
   * Renderer-init resource. Source tracks `gl()`; on every swap the fetcher
   * runs and returns either:
   * - a synchronous `true` (no `init()` method or already initialized) →
   *   resource is `"ready"` immediately, render loop can render.
   * - a Promise that resolves once `renderer.init()` finishes (WebGPU) →
   *   resource is `"pending"` until then.
   *
   * Solid's `createResource` cancels stale in-flight fetches when the
   * source changes, so we don't need a manual `cancelled` flag.
   */
  const [rendererReady] = createResource(
    () => gl(),
    renderer => {
      const init = getPendingInit(renderer)
      if (!init) return true
      // Pre-size the canvas backing buffer before awaiting `init()`.
      // WebGPURenderer allocates its depth attachment during `init()` based on
      // the canvas's current `width`/`height`. An unsized canvas defaults to
      // 300×150, so without this the first `setSize(...)` from the resize
      // observer ends up with a 300×150 depth buffer paired with a full-size
      // color buffer — WebGPU rejects that mismatch on the first frame.
      // Mirrors r3f v10's WebGPU init handling (see pmndrs/react-three-fiber#3651).
      const rect = canvas.getBoundingClientRect()
      const ratio = globalThis.devicePixelRatio || 1
      if (rect.width > 0 && rect.height > 0) {
        canvas.width = rect.width * ratio
        canvas.height = rect.height * ratio
      }
      return init().then(() => true)
    },
  )

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
      // Renderers without a pixel-ratio API (CSS2D/3D, SVG) didn't scale
      // anything — reporting `1` is honest. Users who need the device's
      // ratio for non-rendering math read `globalThis.devicePixelRatio`
      // directly, or pass a renderer that actually has `getPixelRatio`.
      return this.gl.getPixelRatio?.() ?? 1
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

      // Apply props.gl as renderer instance properties only when it's a
      // config object or tuple — not a factory or a pre-built instance. For
      // the tuple form, the instance-writable side is slot 1; for the
      // single-object form, the whole object goes through.
      const _propsGl = props.gl
      if (_propsGl && typeof _propsGl !== "function" && !isRenderer(_propsGl)) {
        useProps(gl, Array.isArray(_propsGl) ? _propsGl[1] : _propsGl)
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

  useSceneGraph(context.scene, {
    get children() {
      return c()
    },
  })

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
