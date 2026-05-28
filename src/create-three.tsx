import { setContext } from "@solidjs/signals"
import {
  children,
  createEffect,
  createMemo,
  createRenderEffect,
  createRoot,
  createSignal,
  latest,
  merge,
  onCleanup,
  untrack,
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
import { SHOULD_DEBUG } from "./constants.ts"
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
  autodispose,
  binarySearch,
  canDriveXR,
  createDebug,
  defaultProps,
  getCurrentViewport,
  getPendingInit,
  isRenderer,
  isWebGLShadowMap,
  meta,
  removeElementFromArray,
  useRef,
} from "./utils.ts"
import { useMeasure } from "./utils/use-measure.ts"

const debug = createDebug("create-three:createThree", SHOULD_DEBUG)
const debugFrame = createDebug("create-three:frameListeners", SHOULD_DEBUG)
const debugXR = createDebug("create-three:XR", SHOULD_DEBUG)
const debugRender = createDebug("create-three:render", SHOULD_DEBUG)
const debugContext = createDebug("create-three:context", SHOULD_DEBUG)
const debugEffects = createDebug("create-three:effects", SHOULD_DEBUG)

/**
 * Creates and manages a `solid-three` scene. It initializes necessary objects like
 * camera, renderer, raycaster, and scene, manages the scene graph, setups up an event system
 * and rendering loop based on the provided properties.
 */
export function createThree(canvas: HTMLCanvasElement, props: CanvasProps) {
  const canvasProps = defaultProps(props, { frameloop: "always" })
  debug("init", () => ({
    frameloop: canvasProps.frameloop,
    orthographic: !!props.orthographic,
    shadows: !!props.shadows,
    linear: !!props.linear,
    flat: !!props.flat,
  }))

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
            debugFrame("registered", () => ({ stage, priority, first: true }))
          } else {
            debugFrame("registered", () => ({ stage, priority }))
          }

          array.push(callback)

          return () => {
            removeElementFromArray(array, callback)
            if (array.length === 0) {
              listeners.map.delete(priority)
              listeners.priorities.splice(listeners.priorities.indexOf(priority), 1)
              debugFrame("empty", () => ({ stage, priority }))
            } else {
              debugFrame("removed", () => ({ stage, priority, remaining: array.length }))
            }
          }
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
    if ((canvasProps.frameloop as string) === "never") {
      debugXR("frame skipped", () => ({ reason: "frameloop=never" }))
      return
    }
    debugXR("frame", () => ({ timestamp }))
    render(timestamp, frame)
  }
  function warnNonXR(method: string) {
    console.warn(
      `solid-three: ${method} is a no-op — the active renderer has no WebXRManager-shaped \`xr\` manager. Pass a WebGLRenderer (or a WebGPURenderer with three's XR layer) to enable XR.`,
    )
  }
  // Toggle render switching on session. `canDriveXR` unifies WebGL and WebGPU:
  // both expose `xr` (event target) + `setAnimationLoop` (on the renderer).
  function handleSessionChange() {
    const _gl = context.gl
    if (!canDriveXR(_gl)) return
    debugXR("session", () => ({
      presenting: _gl.xr.isPresenting,
      enabled: _gl.xr.enabled,
    }))
    _gl.xr.enabled = _gl.xr.isPresenting
    _gl.setAnimationLoop(_gl.xr.isPresenting ? handleXRFrame : null)
  }
  // WebXR session-manager
  const xr = {
    connect() {
      const _gl = context.gl
      if (!canDriveXR(_gl)) return warnNonXR("xr.connect()")
      debugXR("connect")
      _gl.xr.addEventListener("sessionstart", handleSessionChange)
      _gl.xr.addEventListener("sessionend", handleSessionChange)
    },
    disconnect() {
      const _gl = context.gl
      if (!canDriveXR(_gl)) return warnNonXR("xr.disconnect()")
      debugXR("disconnect")
      _gl.xr.removeEventListener("sessionstart", handleSessionChange)
      _gl.xr.removeEventListener("sessionend", handleSessionChange)
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
      debugRender("skipped", () => ({ reason: "no gl" }))
      return
    }
    // `latest()` reads the most-recently-committed signal value, bypassing
    // any pending async overlay. The init signal commits `true` once
    // `renderer.init()` resolves — before that, latest returns undefined.
    if (latest(rendererReady) !== true) {
      debugRender("skipped", () => ({ reason: "gl not initialized" }))
      return
    }
    if (props.frameloop === "never") {
      debugRender("clock override", () => ({ elapsedTime: timestamp }))
      context.clock.elapsedTime = timestamp
    }
    pendingRenderRequest = undefined

    const delta = context.clock.getDelta()
    debugRender("tick", () => ({
      timestamp,
      delta,
      frame: !!frame,
      sceneChildren: context.scene.children.length,
    }))
    updateFrameListeners("before", delta, frame)
    context.gl.render(context.scene, context.camera)
    updateFrameListeners("after", delta, frame)
  }
  function requestRender() {
    if (pendingRenderRequest) {
      debugRender("queued", () => ({ coalesced: true }))
      return
    }
    debugRender("queued", () => ({ coalesced: false }))
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
  // The full prop config is read INSIDE the branch that needs it via
  // `untrack`, so reactive config-objects (e.g. `<Canvas camera={{ position: pos() }}>`)
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
   * Keys of `WebGLRendererParameters` that configure context creation or are
   * otherwise constructor-only. The default-branch of the `gl` memo
   * partitions a flat `gl={...}` prop into ctor args (baked once at
   * construction, since WebGL's `getContext` is idempotent per canvas) and
   * instance props (reactive via `useProps`). See the warn-on-update effect
   * below for what happens when the user changes a ctor key reactively.
   */
  const WEBGL_CTOR_KEYS = [
    "alpha",
    "antialias",
    "depth",
    "failIfMajorPerformanceCaveat",
    "logarithmicDepthBuffer",
    "powerPreference",
    "precision",
    "premultipliedAlpha",
    "preserveDrawingBuffer",
    "reversedDepthBuffer",
    "stencil",
  ] as const satisfies readonly (keyof WebGLRendererParameters)[]
  // Initial ctor-arg snapshot (untracked) — used to detect post-construction
  // changes the user might be expecting to take effect, but can't (WebGL
  // contexts are immutable once created).
  let initialCtorArgs: Partial<WebGLRendererParameters> = {}

  const camera = createMemo(() => {
    let cameraInstance: OrthographicCamera | PerspectiveCamera
    if (cameraIsInstance()) {
      debugContext("camera", () => ({ source: "custom" }))
      cameraInstance = untrack(() => props.camera) as OrthographicCamera | PerspectiveCamera
    } else if (orthographicFlag()) {
      debugContext("camera", () => ({ source: "new OrthographicCamera" }))
      cameraInstance = new OrthographicCamera()
    } else {
      debugContext("camera", () => ({ source: "new PerspectiveCamera" }))
      cameraInstance = new PerspectiveCamera()
    }
    return meta(cameraInstance, {
      get props() {
        return props.camera || {}
      },
    })
  })
  const cameraStack = new Stack<CameraKind>("camera")

  const scene = createMemo(() => {
    let sceneInstance: Scene
    if (sceneIsInstance()) {
      debugContext("scene", () => ({ source: "custom" }))
      sceneInstance = untrack(() => props.scene) as Scene
    } else {
      debugContext("scene", () => ({ source: "new Scene" }))
      sceneInstance = new Scene()
    }
    return meta(sceneInstance, {
      get props() {
        return props.scene || {}
      },
    })
  })

  const raycaster = createMemo(() => {
    let instance: Raycaster | EventRaycaster
    if (raycasterIsInstance()) {
      debugContext("raycaster", () => ({ source: "custom" }))
      instance = untrack(() => props.raycaster) as Raycaster
    } else {
      debugContext("raycaster", () => ({ source: "new CursorRaycaster" }))
      instance = new CursorRaycaster()
    }
    return meta<Raycaster | EventRaycaster>(instance, {
      get props() {
        return props.raycaster || {}
      },
    })
  })

  const raycasterStack = new Stack<Raycaster>("raycaster")

  const gl = createMemo(() => {
    const kind = glKind()
    let rendererInstance: Renderer
    if (kind === "instance") {
      debugContext("gl", () => ({ source: "custom" }))
      rendererInstance = untrack(() => props.gl) as Renderer
    } else if (kind === "factory") {
      debugContext("gl", () => ({ source: "factory" }))
      const factory = untrack(() => props.gl) as (canvas: HTMLCanvasElement) => Renderer
      rendererInstance = autodispose(factory(canvas))
    } else {
      debugContext("gl", () => ({ source: "default" }))
      // Default branch — construct a WebGLRenderer with the user's flat `gl`
      // prop. Split via `WEBGL_CTOR_KEYS`: those keys go to the constructor
      // (baked in for the renderer's lifetime, since WebGL won't give us a
      // fresh context on the same canvas), the rest are applied as instance
      // props via the `useProps` call below. `alpha: true` is our default;
      // the user's value (if any) wins. `canvas` is last so the user can't
      // override it.
      const flat = untrack(() => (props.gl as Partial<WebGLRendererParameters>) ?? {})
      const ctorArgs: Partial<WebGLRendererParameters> = {}
      for (const key of WEBGL_CTOR_KEYS) {
        if (key in flat) ctorArgs[key] = flat[key] as never
      }
      initialCtorArgs = ctorArgs
      rendererInstance = autodispose(new WebGLRenderer({ alpha: true, ...ctorArgs, canvas }))
    }

    return meta(rendererInstance, {
      get props() {
        return props.gl || {}
      },
    })
  })

  // Await `renderer.init()` before the first frame (WebGPU). WebGL renderers
  // have no `init()` and resolve synchronously. `createSignal(async fn)` is the
  // Solid 2.x idiom — the signal stays pending until the Promise resolves and
  // `isPending(rendererReady)` gates the render loop.
  const [rendererReady] = createSignal<boolean>(async () => {
    const renderer = gl()
    const init = getPendingInit(renderer)
    if (!init) {
      debugEffects("gl init", () => ({ action: "skip", reason: "no-init-or-already" }))
      return true
    }
    // Pre-size the canvas backing buffer before init so WebGPU's depth
    // attachment matches the container; otherwise the default 300×150
    // buffer mismatches on the first resize.
    const rect = canvas.getBoundingClientRect()
    const ratio = globalThis.devicePixelRatio || 1
    if (rect.width > 0 && rect.height > 0) {
      canvas.width = rect.width * ratio
      canvas.height = rect.height * ratio
    }
    debugEffects("gl init", () => ({ action: "await" }))
    await init()
    debugEffects("gl init", () => ({ action: "ready" }))
    return true
  })

  const measure = useMeasure({ element: canvas })

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
      // anything — reporting `1` is honest.
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
  debug("context ready", () => ({ contextKeys: Object.keys(context) }))

  setContext(threeContext, context)
  setContext(frameContext, addFrameListener)

  /**********************************************************************************/
  /*                                                                                */
  /*                                     Effects                                    */
  /*                                                                                */
  /**********************************************************************************/

  createRenderEffect(
    () => props.frameloop,
    frameloop => {
      if (frameloop === "never") {
        debugEffects("clock", () => ({ action: "stop", reason: "frameloop=never" }))
        context.clock.stop()
        context.clock.elapsedTime = 0
      } else {
        debugEffects("clock", () => ({ action: "start", frameloop: frameloop ?? "always" }))
        context.clock.start()
      }
    },
  )

  // Manage camera — useProps must be in compute phase (creates reactive nodes)
  createRenderEffect(
    () => {
      const peek = cameraStack.peek()
      const dc = props.camera
      if (peek) {
        debugEffects("camera", () => ({ action: "skip", reason: "stack-peek" }))
        return
      }
      if (!dc || dc instanceof Camera) {
        debugEffects("camera", () => ({
          action: "skip",
          reason: !dc ? "no-default" : "instance",
        }))
        return
      }
      debugEffects("camera", () => ({ action: "apply" }))
      useProps(camera, dc)
      return camera()
    },
    camera => {
      if (camera) {
        // Manually update camera's matrix with updateMatrixWorld is needed.
        // Otherwise casting a ray immediately after start-up will cause the incorrect matrix to be used.
        debugEffects("camera", () => ({ action: "updateMatrixWorld" }))
        camera.updateMatrixWorld(true)
      } else {
        debugEffects("camera", () => ({ action: "skip", reason: "no camera" }))
      }
    },
  )

  // Manage scene — useProps must be in compute phase (creates reactive nodes)
  createRenderEffect(
    () => {
      const scene_ = props.scene
      if (!scene_ || scene_ instanceof Scene) {
        debugEffects("scene", () => ({
          action: "skip",
          reason: !scene_ ? "no-default" : "instance",
        }))
        return
      }
      debugEffects("scene", () => ({ action: "apply" }))
      useProps(scene, scene_)
    },
    () => {},
  )

  // Manage raycaster — useProps must be in compute phase (creates reactive nodes)
  createRenderEffect(
    () => {
      const raycaster = props.raycaster
      if (!raycaster || raycaster instanceof Raycaster) {
        debugEffects("raycaster", () => ({
          action: "skip",
          reason: !raycaster ? "no-default" : "instance",
        }))
        return
      }
      debugEffects("raycaster", () => ({ action: "apply" }))
      useProps(raycaster, raycaster)
    },
    () => {},
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
              ? ((
                  {
                    basic: BasicShadowMap,
                    percentage: PCFShadowMap,
                    soft: PCFSoftShadowMap,
                    variance: VSMShadowMap,
                  } as const
                )[props.shadows] ?? PCFSoftShadowMap)
              : PCFSoftShadowMap,
          shadowsObj: typeof props.shadows === "object" ? props.shadows : undefined,
          gl: gl(),
        }),
        ({ enabled, type, shadowsObj, gl: _gl }) => {
          if (!_gl.shadowMap) {
            debugEffects("shadow", () => ({ action: "skip", reason: "no-shadowmap" }))
            return
          }
          const changed = _gl.shadowMap.enabled !== enabled || _gl.shadowMap.type !== type
          _gl.shadowMap.enabled = enabled
          if (shadowsObj) {
            debugEffects("shadow", () => ({ action: "apply", via: "object" }))
            Object.assign(_gl.shadowMap, shadowsObj)
          } else {
            debugEffects("shadow", () => ({ action: "apply", via: "type", type }))
            _gl.shadowMap.type = type
          }
          if (changed) {
            // WebGL-only: signals the renderer to re-bake. WebGPURenderer's
            // shadowMap is `{ enabled, type }` without `needsUpdate`.
            if (isWebGLShadowMap(_gl.shadowMap)) {
              _gl.shadowMap.needsUpdate = true
            }
            debugEffects("shadow", () => ({
              action: "changed",
              enabled,
              type,
              custom: !!shadowsObj,
            }))
          } else {
            debugEffects("shadow", () => ({ action: "unchanged" }))
          }
        },
      )

      // XR connect — `canDriveXR` unifies WebGL and WebGPU: both expose `xr`
      // (event target) + `setAnimationLoop` on the renderer.
      createRenderEffect(
        () => gl(),
        renderer => {
          if (canDriveXR(renderer)) {
            debugEffects("xr connect", () => ({ hasXR: true }))
            renderer.xr.addEventListener("sessionstart", handleSessionChange)
            renderer.xr.addEventListener("sessionend", handleSessionChange)
            return () => {
              renderer.xr.removeEventListener("sessionstart", handleSessionChange)
              renderer.xr.removeEventListener("sessionend", handleSessionChange)
            }
          } else {
            debugEffects("xr connect", () => ({ action: "skip", reason: "no xr on renderer" }))
          }
        },
      )

      // Color management — structural gate so exotic renderers (SVGRenderer,
      // custom) without `outputColorSpace` are skipped instead of crashing.
      createRenderEffect(
        () => ({ renderer: gl(), linear: !!props.linear }),
        ({ renderer, linear }) => {
          if (!("outputColorSpace" in renderer)) {
            debugEffects("outputColorSpace", () => ({ action: "skip", reason: "not supported" }))
            return
          }
          debugEffects("outputColorSpace", () => ({ linear }))
          ;(renderer as { outputColorSpace: string }).outputColorSpace = linear
            ? LinearSRGBColorSpace
            : SRGBColorSpace
        },
      )

      // Tone mapping — structural gate (same reason as color management).
      createRenderEffect(
        () => ({ renderer: gl(), flat: !!props.flat }),
        ({ renderer, flat }) => {
          if (!("toneMapping" in renderer)) {
            debugEffects("toneMapping", () => ({ action: "skip", reason: "not supported" }))
            return
          }
          debugEffects("toneMapping", () => ({ flat }))
          ;(renderer as { toneMapping: number }).toneMapping = flat
            ? NoToneMapping
            : ACESFilmicToneMapping
        },
      )

      // Apply props.gl as renderer instance properties — only when it's a
      // config object, not a factory or a pre-built instance. Ctor-only keys
      // in the flat object (e.g. `antialias`) get assigned to the instance
      // too; that's a harmless junk property on the renderer (three doesn't
      // re-read them). The warn effect below catches users who *expect*
      // those changes to take effect.
      const _propsGl = props.gl
      if (_propsGl && typeof _propsGl !== "function" && !isRenderer(_propsGl)) {
        debugEffects("gl", () => ({ action: "apply", type: "user-options" }))
        useProps(gl, _propsGl as object)
      } else {
        debugEffects("gl", () => ({
          action: "skip",
          reason: !_propsGl ? "no gl prop" : "gl is renderer instance or factory",
        }))
      }

      // Warn when the user reactively changes a constructor-only key. WebGL
      // bakes these into the context at creation and never re-reads them, so
      // a Solid-style reactive change here is a silent no-op without this.
      let warnedCtorKeys = false
      createEffect(
        () => props.gl,
        flatProp => {
          if (warnedCtorKeys) return
          const flat = (flatProp as Partial<WebGLRendererParameters>) ?? {}
          for (const key of WEBGL_CTOR_KEYS) {
            if (key in flat && flat[key] !== initialCtorArgs[key]) {
              console.warn(
                `solid-three: <Canvas gl={...}> received a new value for "${String(key)}", ` +
                  `but WebGLRenderer constructor args are immutable for the canvas's lifetime. ` +
                  `To swap renderer config at runtime, unmount and remount <Canvas>.`,
              )
              warnedCtorKeys = true
              return
            }
          }
        },
      )
    },
    () => {},
  )

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
        debugRender("loop", () => ({ action: "start" }))
        pendingLoopRequest = requestAnimationFrame(loop)
      } else {
        debugRender("loop", () => ({ action: "idle", mode: frameloop }))
      }
      return () => pendingLoopRequest && cancelAnimationFrame(pendingLoopRequest)
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

  useSceneGraph(() => context.scene, {
    get children() {
      return c()
    },
  })

  useRef(props, context)

  // Return context merged with `addFrameListeners``
  // This is used in `@solid-three/testing`
  return merge(context, { addFrameListener })
}
