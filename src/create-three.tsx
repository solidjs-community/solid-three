import { ReactiveMap } from "@solid-primitives/map"
import {
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
import type { CanvasProps } from "./create-canvas.tsx"
import { frameContext, threeContext } from "./hooks.ts"
import { pluginContext } from "./internal-context.ts"
import { useProps, useSceneGraph } from "./props.ts"
import { CursorRaycaster, type EventRaycaster } from "./raycasters.tsx"
import type { CameraKind, Context, FrameListener, FrameListenerCallback, Plugin } from "./types.ts"
import {
  binarySearch,
  defaultProps,
  getCurrentViewport,
  meta,
  removeElementFromArray,
  useRef,
  withContext,
  withMultiContexts,
} from "./utils.ts"
import { Stack } from "./utils/stack.ts"
import { useMeasure } from "./utils/use-measure.ts"

/**
 * Creates and manages a `solid-three` scene. It initializes necessary objects like
 * camera, renderer, raycaster, and scene, manages the scene graph, setups up a rendering loop
 * based on the provided properties.
 */
export function createThree(canvas: HTMLCanvasElement, props: CanvasProps, plugins: Plugin[]) {
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
    context.gl.render(context.scene, context.currentCamera)
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

  const glProp = createMemo(() => props.gl)
  const gl = createMemo(() => {
    const _glProp = glProp()
    return meta(
      _glProp instanceof WebGLRenderer
        ? // _glProp can be a WebGLRenderer provided by the user
          _glProp
        : typeof _glProp === "function"
        ? // or a callback that returns a Renderer
          _glProp(canvas)
        : // if _glProp is not defined we default to a WebGLRenderer
          new WebGLRenderer({ canvas }),
      {
        get props() {
          return glProp() || {}
        },
      },
    )
  })

  const measure = useMeasure()
  measure.setElement(canvas)

  const defaultTarget = new Vector3()
  const viewport = createMemo(() =>
    getCurrentViewport(defaultCamera(), defaultTarget, measure.bounds()),
  )

  const clock = new Clock()
  clock.start()

  const pluginMap = new ReactiveMap<Plugin, ReturnType<Plugin>>()

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
    registerPlugin(plugin) {
      let result = pluginMap.get(plugin)
      if (result) {
        return result
      }
      result = plugin(context)
      pluginMap.set(plugin, result)
      return result
    },
    render,
    requestRender,
    get viewport() {
      return viewport()
    },
    xr,
    // elements
    get currentCamera() {
      return cameraStack.peek() ?? defaultCamera()
    },
    setCurrentCamera(camera: CameraKind) {
      return cameraStack.push(camera)
    },
    get scene() {
      return scene()
    },
    get currentRaycaster() {
      return raycasterStack.peek() || defaultRaycaster()
    },
    setCurrentRaycaster(raycaster: Raycaster) {
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

  withContext(
    () => {
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
        if (!props.defaultCamera || props.defaultCamera instanceof Camera) return
        useProps(defaultCamera, props.defaultCamera)
        // NOTE:  Manually update camera's matrix with updateMatrixWorld is needed.
        //        Otherwise casting a ray immediately after start-up will cause the incorrect matrix to be used.
        defaultCamera().updateMatrixWorld(true)
      })

      // Manage scene
      createRenderEffect(() => {
        if (!props.scene || props.scene instanceof Scene) return
        useProps(scene, props.scene)
      })

      // Manage raycaster
      createRenderEffect(() => {
        if (!props.defaultRaycaster || props.defaultRaycaster instanceof Raycaster) return
        useProps(defaultRaycaster, props.defaultRaycaster)
      })

      // Manage gl
      createRenderEffect(() => {
        // Set shadow-map
        createRenderEffect(() => {
          const _gl = gl()

          if (_gl.shadowMap) {
            const oldEnabled = _gl.shadowMap.enabled
            const oldType = _gl.shadowMap.type
            _gl.shadowMap.enabled = !!props.shadows

            if (typeof props.shadows === "boolean") {
              _gl.shadowMap.type = PCFSoftShadowMap
            } else if (typeof props.shadows === "string") {
              const types = {
                basic: BasicShadowMap,
                percentage: PCFShadowMap,
                soft: PCFSoftShadowMap,
                variance: VSMShadowMap,
              }
              _gl.shadowMap.type = types[props.shadows] ?? PCFSoftShadowMap
            } else if (typeof props.shadows === "object") {
              Object.assign(_gl.shadowMap, props.shadows)
            }

            if (oldEnabled !== _gl.shadowMap.enabled || oldType !== _gl.shadowMap.type)
              _gl.shadowMap.needsUpdate = true
          }
        })

        createEffect(() => {
          const renderer = gl()
          // Connect to xr if property exists
          if (renderer.xr) context.xr.connect()
        })

        // Set color space and tonemapping preferences
        const LinearEncoding = 3000
        const sRGBEncoding = 3001
        // Color management and tone-mapping
        useProps(gl, {
          get outputEncoding() {
            return props.linear ? LinearEncoding : sRGBEncoding
          },
          get toneMapping() {
            return props.flat ? NoToneMapping : ACESFilmicToneMapping
          },
        })

        // Manage props
        const _glProp = glProp()
        if (_glProp && !(_glProp instanceof WebGLRenderer)) {
          useProps(gl, _glProp)
        }
      })
    },
    threeContext,
    context,
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
  createRenderEffect(() => {
    if (canvasProps.frameloop === "always") {
      pendingLoopRequest = requestAnimationFrame(loop)
    }
    onCleanup(() => pendingLoopRequest && cancelAnimationFrame(pendingLoopRequest))
  })

  /**********************************************************************************/
  /*                                                                                */
  /*                                   Scene Graph                                  */
  /*                                                                                */
  /**********************************************************************************/

  useSceneGraph(
    context.scene,
    mergeProps(props, {
      children: (
        <pluginContext.Provider value={plugins}>
          <frameContext.Provider value={addFrameListener}>
            <threeContext.Provider value={context}>{canvasProps.children}</threeContext.Provider>
          </frameContext.Provider>
        </pluginContext.Provider>
      ),
    }),
  )

  // Return context merged with `addFrameListeners``
  // This is used in `@solid-three/testing`
  return mergeProps(context, { addFrameListener })
}
