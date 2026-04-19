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
import { SHOULD_DEBUG } from "./constants.ts"
import { createEvents } from "./create-events.ts"
import { Stack } from "./data-structure/stack.ts"
import { frameContext, threeContext } from "./hooks.ts"
import { eventContext } from "./internal-context.ts"
import { useProps, useSceneGraph } from "./props.ts"
import { CursorRaycaster, type EventRaycaster } from "./raycasters.tsx"
import type { CameraKind, Context, FrameListener, FrameListenerCallback } from "./types.ts"
import {
  binarySearch,
  createDebug,
  defaultProps,
  getCurrentViewport,
  meta,
  removeElementFromArray,
  useRef,
  withMultiContexts,
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
  debug("init", {
    frameloop: canvasProps.frameloop,
    orthographic: !!props.orthographic,
    shadows: !!props.shadows,
    linear: !!props.linear,
    flat: !!props.flat,
  })

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
            debugFrame("registered", { stage, priority, first: true })
          } else {
            debugFrame("registered", { stage, priority })
          }

          array.push(callback)

          return () => {
            removeElementFromArray(array, callback)
            if (array.length === 0) {
              listeners.map.delete(priority)
              listeners.priorities.splice(listeners.priorities.indexOf(priority), 1)
              debugFrame("empty", { stage, priority })
            } else {
              debugFrame("removed", { stage, priority, remaining: array.length })
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
      debugXR("frame skipped", { reason: "frameloop=never" })
      return
    }
    debugXR("frame", { timestamp })
    render(timestamp, frame)
  }
  // Toggle render switching on session
  function handleSessionChange() {
    debugXR("session", {
      presenting: context.gl.xr.isPresenting,
      enabled: context.gl.xr.enabled,
    })
    context.gl.xr.enabled = context.gl.xr.isPresenting
    context.gl.xr.setAnimationLoop(context.gl.xr.isPresenting ? handleXRFrame : null)
  }
  // WebXR session-manager
  const xr = {
    connect() {
      debugXR("connect")
      context.gl.xr.addEventListener("sessionstart", handleSessionChange)
      context.gl.xr.addEventListener("sessionend", handleSessionChange)
    },
    disconnect() {
      debugXR("disconnect")
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
      debugRender("skipped", { reason: "no gl" })
      return
    }
    if (props.frameloop === "never") {
      debugRender("clock override", { elapsedTime: timestamp })
      context.clock.elapsedTime = timestamp
    }
    pendingRenderRequest = undefined

    const delta = context.clock.getDelta()
    debugRender("tick", {
      timestamp,
      delta,
      frame: !!frame,
      sceneChildren: context.scene.children.length,
    })
    updateFrameListeners("before", delta, frame)
    context.gl.render(context.scene, context.camera)
    updateFrameListeners("after", delta, frame)
  }
  function requestRender() {
    if (pendingRenderRequest) {
      debugRender("queued", { coalesced: true })
      return
    }
    debugRender("queued", { coalesced: false })
    pendingRenderRequest = requestAnimationFrame(render)
  }
  onCleanup(() => pendingRenderRequest && cancelAnimationFrame(pendingRenderRequest))

  /**********************************************************************************/
  /*                                                                                */
  /*                                  Three Context                                 */
  /*                                                                                */
  /**********************************************************************************/

  const defaultCamera = createMemo(() => {
    if (props.defaultCamera instanceof Camera) {
      debugContext("camera", { source: "custom" })
      return props.defaultCamera as OrthographicCamera | PerspectiveCamera
    }
    if (props.orthographic) {
      debugContext("camera", { source: "new OrthographicCamera" })
      return new OrthographicCamera()
    }
    debugContext("camera", { source: "new PerspectiveCamera" })
    return new PerspectiveCamera()
  })
  const cameraStack = new Stack<CameraKind>("camera")

  const scene = createMemo(() => {
    let sceneInstance: Scene
    if (props.scene instanceof Scene) {
      debugContext("scene", { source: "custom" })
      sceneInstance = props.scene
    } else {
      debugContext("scene", { source: "new Scene" })
      sceneInstance = new Scene()
    }
    return meta(sceneInstance, {
      get props() {
        return props.scene || {}
      },
    })
  })

  const defaultRaycaster = createMemo(() => {
    let instance: Raycaster | EventRaycaster
    if (props.defaultRaycaster instanceof Raycaster) {
      debugContext("raycaster", { source: "custom" })
      instance = props.defaultRaycaster
    } else {
      debugContext("raycaster", { source: "new CursorRaycaster" })
      instance = new CursorRaycaster()
    }
    return meta<Raycaster | EventRaycaster>(instance, {
      get props() {
        return props.defaultRaycaster || {}
      },
    })
  })

  const raycasterStack = new Stack<Raycaster>("raycaster")

  const gl = createMemo(() => {
    let rendererInstance: WebGLRenderer
    if (props.gl instanceof WebGLRenderer) {
      debugContext("gl", { source: "custom" })
      rendererInstance = props.gl
    } else if (typeof props.gl === "function") {
      debugContext("gl", { source: "factory" })
      rendererInstance = props.gl(canvas)
    } else {
      debugContext("gl", { source: "default" })
      rendererInstance = new WebGLRenderer({ canvas, alpha: true })
    }

    return meta(rendererInstance, {
      get props() {
        return props.gl || {}
      },
    })
  })

  const measure = useMeasure({ element: canvas })

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
  debug("context ready", { contextKeys: Object.keys(context) })

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
          debugEffects("clock", { action: "stop", reason: "frameloop=never" })
          context.clock.stop()
          context.clock.elapsedTime = 0
        } else {
          debugEffects("clock", { action: "start", frameloop: frameloop ?? "always" })
          context.clock.start()
        }
      },
    )

    // Manage camera — useProps must be in compute phase (creates reactive nodes)
    createRenderEffect(
      () => {
        const peek = cameraStack.peek()
        const dc = props.defaultCamera
        if (peek) {
          debugEffects("camera", { action: "skip", reason: "stack-peek" })
          return
        }
        if (!dc || dc instanceof Camera) {
          debugEffects("camera", { action: "skip", reason: !dc ? "no-default" : "instance" })
          return
        }
        debugEffects("camera", { action: "apply" })
        useProps(defaultCamera, dc)
        return defaultCamera()
      },
      camera => {
        if (camera) {
          // Manually update camera's matrix with updateMatrixWorld is needed.
          // Otherwise casting a ray immediately after start-up will cause the incorrect matrix to be used.
          debugEffects("camera", { action: "updateMatrixWorld" })
          camera.updateMatrixWorld(true)
        } else {
          debugEffects("camera", { action: "skip", reason: "no camera" })
        }
      },
    )

    // Manage scene — useProps must be in compute phase (creates reactive nodes)
    createRenderEffect(
      () => {
        const scene_ = props.scene
        if (!scene_ || scene_ instanceof Scene) {
          debugEffects("scene", { action: "skip", reason: !scene_ ? "no-default" : "instance" })
          return
        }
        debugEffects("scene", { action: "apply" })
        useProps(scene, scene_)
      },
      () => {},
    )

    // Manage raycaster — useProps must be in compute phase (creates reactive nodes)
    createRenderEffect(
      () => {
        const raycaster = props.defaultRaycaster
        if (!raycaster || raycaster instanceof Raycaster) {
          debugEffects("raycaster", {
            action: "skip",
            reason: !raycaster ? "no-default" : "instance",
          })
          return
        }
        debugEffects("raycaster", { action: "apply" })
        useProps(defaultRaycaster, raycaster)
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
              debugEffects("shadow", { action: "skip", reason: "no-shadowmap" })
              return
            }
            const changed = _gl.shadowMap.enabled !== enabled || _gl.shadowMap.type !== type
            _gl.shadowMap.enabled = enabled
            if (shadowsObj) {
              debugEffects("shadow", { action: "apply", via: "object" })
              Object.assign(_gl.shadowMap, shadowsObj)
            } else {
              debugEffects("shadow", { action: "apply", via: "type", type })
              _gl.shadowMap.type = type
            }
            if (changed) {
              _gl.shadowMap.needsUpdate = true
              debugEffects("shadow", { action: "changed", enabled, type, custom: !!shadowsObj })
            } else {
              debugEffects("shadow", { action: "unchanged" })
            }
          },
        )

        // XR connect — intentionally createEffect (DOM side effect, not render phase) ✓
        createEffect(
          () => gl(),
          renderer => {
            if (renderer.xr) {
              debugEffects("xr connect", { hasXR: true })
              context.xr.connect()
            } else {
              debugEffects("xr connect", { action: "skip", reason: "no xr on renderer" })
            }
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
          debugEffects("gl", { action: "apply", type: "user-options" })
          useProps(gl, props.gl)
        } else {
          debugEffects("gl", {
            action: "skip",
            reason: !props.gl ? "no gl prop" : "gl is WebGLRenderer instance",
          })
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
        debugRender("loop", { action: "start" })
        pendingLoopRequest = requestAnimationFrame(loop)
      } else {
        debugRender("loop", { action: "idle", mode: frameloop })
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

  // Return context merged with `addFrameListeners``
  // This is used in `@solid-three/testing`
  return merge(context, { addFrameListener })
}
