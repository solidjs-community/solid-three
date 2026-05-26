import { setContext } from "@solidjs/signals"
import { children, createMemo, createRenderEffect, createRoot, merge, onCleanup } from "solid-js"
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
  RendererLike,
} from "./types.ts"
import {
  binarySearch,
  createDebug,
  defaultProps,
  getCurrentViewport,
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
  // Toggle render switching on session. The current wiring is built for
  // `WebXRManager` (WebGL build). Task 4 introduces `isWebXRManager` for
  // proper duck-typing — for now we early-return when absent and cast the
  // present manager to `WebXRManager` to preserve the existing API surface.
  function handleSessionChange() {
    const xrManager = context.gl.xr as WebGLRenderer["xr"] | undefined
    if (!xrManager) return
    debugXR("session", () => ({
      presenting: xrManager.isPresenting,
      enabled: xrManager.enabled,
    }))
    xrManager.enabled = xrManager.isPresenting
    xrManager.setAnimationLoop(xrManager.isPresenting ? handleXRFrame : null)
  }
  // WebXR session-manager
  const xr = {
    connect() {
      const xrManager = context.gl.xr as WebGLRenderer["xr"] | undefined
      if (!xrManager) return
      debugXR("connect")
      xrManager.addEventListener("sessionstart", handleSessionChange)
      xrManager.addEventListener("sessionend", handleSessionChange)
    },
    disconnect() {
      const xrManager = context.gl.xr as WebGLRenderer["xr"] | undefined
      if (!xrManager) return
      debugXR("disconnect")
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
  // Render loop spins harmlessly until `renderer.init()` resolves (WebGPU).
  // WebGL renderers report ready synchronously, so this flips to `true`
  // immediately in the init effect below. Task 6 will refactor this into
  // a `createResource`.
  let glInitialized = true

  function render(timestamp: number, frame?: XRFrame) {
    if (!context.gl) {
      debugRender("skipped", () => ({ reason: "no gl" }))
      return
    }
    if (!glInitialized) {
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

  const camera = createMemo(() => {
    if (props.camera instanceof Camera) {
      debugContext("camera", () => ({ source: "custom" }))
      return props.camera as OrthographicCamera | PerspectiveCamera
    }
    if (props.orthographic) {
      debugContext("camera", () => ({ source: "new OrthographicCamera" }))
      return new OrthographicCamera()
    }
    debugContext("camera", () => ({ source: "new PerspectiveCamera" }))
    return new PerspectiveCamera()
  })
  const cameraStack = new Stack<CameraKind>("camera")

  const scene = createMemo(() => {
    let sceneInstance: Scene
    if (props.scene instanceof Scene) {
      debugContext("scene", () => ({ source: "custom" }))
      sceneInstance = props.scene
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
    if (props.raycaster instanceof Raycaster) {
      debugContext("raycaster", () => ({ source: "custom" }))
      instance = props.raycaster
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
    const propsGl = props.gl
    let rendererInstance: Renderer
    // Instance check first — recognise any RendererLike (incl. WebGPURenderer)
    // regardless of class, otherwise an `instanceof WebGLRenderer` would skip it.
    // Task 4 will replace this inline check with `isRenderer()`.
    if (
      propsGl &&
      typeof propsGl === "object" &&
      !Array.isArray(propsGl) &&
      typeof (propsGl as Renderer).render === "function" &&
      typeof (propsGl as Renderer).setSize === "function"
    ) {
      debugContext("gl", () => ({ source: "custom" }))
      rendererInstance = propsGl as Renderer
    } else if (typeof propsGl === "function") {
      debugContext("gl", () => ({ source: "factory" }))
      rendererInstance = propsGl(canvas)
    } else {
      debugContext("gl", () => ({ source: "default" }))
      rendererInstance = new WebGLRenderer({ canvas, alpha: true })
    }

    return meta(rendererInstance, {
      get props() {
        return props.gl || {}
      },
    })
  })

  // Await `renderer.init()` before the first frame (WebGPU). WebGL renderers
  // have no `init()` and resolve synchronously. Intermediate form — Task 6
  // will lift this into a `createResource`.
  createRenderEffect(
    () => gl(),
    renderer => {
      glInitialized = false
      let cancelled = false
      onCleanup(() => {
        cancelled = true
      })

      const initFn = (renderer as RendererLike).init
      const hasInitialized = (renderer as RendererLike).hasInitialized
      const alreadyInitialized = hasInitialized?.call(renderer) === true

      if (!initFn || alreadyInitialized) {
        debugEffects("gl init", () => ({ action: "skip", reason: !initFn ? "no-init" : "already" }))
        glInitialized = true
        return
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
      initFn.call(renderer).then(() => {
        if (!cancelled) {
          debugEffects("gl init", () => ({ action: "ready" }))
          glInitialized = true
        }
      })
    },
  )

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
            // `needsUpdate` only exists on `WebGLShadowMap`; Task 4 introduces
            // `isWebGLShadowMap` for proper narrowing.
            if ("needsUpdate" in _gl.shadowMap) {
              ;(_gl.shadowMap as { needsUpdate: boolean }).needsUpdate = true
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

      // XR connect — duck-typed to WebGLRenderer's `xr` until Task 4 lands
      // `isWebXRManager` to discriminate WebGL vs WebGPU XR managers.
      createRenderEffect(
        () => gl(),
        renderer => {
          const xrManager = renderer.xr as WebGLRenderer["xr"] | undefined
          if (xrManager) {
            debugEffects("xr connect", () => ({ hasXR: true }))
            xrManager.addEventListener("sessionstart", handleSessionChange)
            xrManager.addEventListener("sessionend", handleSessionChange)
            return () => {
              xrManager.removeEventListener("sessionstart", handleSessionChange)
              xrManager.removeEventListener("sessionend", handleSessionChange)
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

      // User-supplied gl options object (must not drop this — handles props.gl={antialias:true} etc.)
      // Apply props only for the config-object branch (not a renderer instance,
      // not a factory function).
      const _propsGl = props.gl
      const isRendererInstance =
        _propsGl &&
        typeof _propsGl === "object" &&
        !Array.isArray(_propsGl) &&
        typeof (_propsGl as Renderer).render === "function" &&
        typeof (_propsGl as Renderer).setSize === "function"
      if (_propsGl && typeof _propsGl !== "function" && !isRendererInstance) {
        debugEffects("gl", () => ({ action: "apply", type: "user-options" }))
        useProps(gl, _propsGl as object)
      } else {
        debugEffects("gl", () => ({
          action: "skip",
          reason: !_propsGl ? "no gl prop" : "gl is renderer instance or factory",
        }))
      }
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

  useSceneGraph(
    () => context.scene,
    merge(props, {
      get children() {
        return c()
      },
    }),
  )

  useRef(props, context)

  // Return context merged with `addFrameListeners``
  // This is used in `@solid-three/testing`
  return merge(context, { addFrameListener })
}
