import {
  createMemo,
  createRenderEffect,
  createRoot,
  createSelector,
  mergeProps,
  onCleanup,
  type Context as SolidContext,
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
import { LinearEncoding, sRGBEncoding } from "./constants.ts"
import { frameContext, threeContext } from "./hooks.ts"
import { pluginContext } from "./internal-context.ts"
import { mergePluginMethods, useProps, useSceneGraph } from "./props.ts"
import { CursorRaycaster } from "./raycasters.tsx"
import type { CameraKind, Context, FrameListener, FrameListenerCallback, Plugin } from "./types.ts"
import type { CanvasProps, EventRaycaster } from "./types.tsx"
import {
  binarySearch,
  getCurrentViewport,
  meta,
  removeElementFromArray,
  useRef,
  withMultiContexts,
} from "./utils.ts"
import { whenRenderEffect } from "./utils/conditionals.ts"
import { Stack } from "./utils/stack.ts"
import { useMeasure } from "./utils/use-measure.ts"

/**
 * Creates and manages a `solid-three` scene. It initializes necessary objects like
 * camera, renderer, raycaster, and scene, manages the scene graph, setups up a rendering loop
 * based on the provided properties.
 */
export function createThree(canvas: HTMLCanvasElement, props: CanvasProps, plugins: Plugin[] = []) {
  const config = mergeProps({ frameloop: "always" }, props)

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
    if (config.frameloop === "never") return
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
    if (config.frameloop === "never") {
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

  const cameraStack = new Stack<CameraKind>("camera")
  const defaultCamera = createMemo(() =>
    meta(
      config.defaultCamera instanceof Camera
        ? (config.defaultCamera as OrthographicCamera | PerspectiveCamera)
        : config.orthographic
        ? new OrthographicCamera()
        : new PerspectiveCamera(),
      {
        get props() {
          return config.defaultCamera || {}
        },
      },
    ),
  )

  const scene = createMemo(() =>
    meta(config.scene instanceof Scene ? config.scene : new Scene(), {
      get props() {
        return config.scene || {}
      },
    }),
  )

  const raycasterStack = new Stack<Raycaster>("raycaster")
  const defaultRaycaster = createMemo(() =>
    meta<Raycaster | EventRaycaster>(
      config.defaultRaycaster instanceof Raycaster
        ? config.defaultRaycaster
        : new CursorRaycaster(),
      {
        get props() {
          return config.defaultRaycaster || {}
        },
      },
    ),
  )

  const gl = createMemo(() => {
    return meta(
      config.gl instanceof WebGLRenderer
        ? // _glProp can be a WebGLRenderer provided by the user
          config.gl
        : typeof config.gl === "function"
        ? // or a callback that returns a Renderer
          config.gl(canvas)
        : // if _glProp is not defined we default to a WebGLRenderer
          new WebGLRenderer({ canvas }),
      {
        get props() {
          return config.gl || {}
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
  /*                                   Render Loop                                  */
  /*                                                                                */
  /**********************************************************************************/

  let pendingLoopRequest: number | undefined
  function loop(value: number) {
    pendingLoopRequest = requestAnimationFrame(loop)
    context.render(value)
  }
  createRenderEffect(() => {
    if (config.frameloop === "always") {
      pendingLoopRequest = requestAnimationFrame(loop)
    }
    onCleanup(() => pendingLoopRequest && cancelAnimationFrame(pendingLoopRequest))
  })

  /**********************************************************************************/
  /*                                                                                */
  /*                                     Effects                                    */
  /*                                                                                */
  /**********************************************************************************/

  createRenderEffect(() => {
    withMultiContexts(() => {
      const pluginMethods = createMemo(() => mergePluginMethods(scene(), plugins))
      const hasPluginMethod = createSelector(
        pluginMethods,
        (key: keyof CanvasProps, methods) => key in methods,
      )

      // Handle scene graph
      useSceneGraph(context.scene, props)

      // Manage clock
      createRenderEffect(() => {
        if (config.frameloop === "never") {
          context.clock.stop()
          context.clock.elapsedTime = 0
        } else {
          context.clock.start()
        }
      })

      // Manage props resolved to plugins
      whenRenderEffect(pluginMethods, pluginMethods => {
        for (const key in config) {
          if (key in pluginMethods) {
            pluginMethods[key]?.(config[key as keyof typeof config])
          }
        }
      })

      // Manage camera
      whenRenderEffect(
        () =>
          !hasPluginMethod("defaultCamera") &&
          !(config.defaultCamera instanceof Camera) &&
          config.defaultCamera,
        propsCamera => {
          useProps(defaultCamera, propsCamera)
          // NOTE:  Manually update camera's matrix with updateMatrixWorld is needed.
          //        Otherwise casting a ray immediately after start-up will cause the incorrect matrix to be used.
          defaultCamera().updateMatrixWorld(true)
        },
      )

      // Manage scene
      whenRenderEffect(
        () => !hasPluginMethod("scene") && !(config.scene instanceof Scene) && config.scene,
        propsScene => useProps(scene, propsScene),
      )

      // Manage raycaster
      whenRenderEffect(
        () =>
          !hasPluginMethod("defaultRaycaster") &&
          !(config.defaultRaycaster instanceof Raycaster) &&
          config.defaultRaycaster,
        raycaster => useProps(defaultRaycaster, raycaster),
      )

      // Manage gl
      whenRenderEffect(gl, gl => {
        // Set shadow-map
        whenRenderEffect(
          () => gl.shadowMap,
          shadowMap => {
            const oldEnabled = shadowMap.enabled
            const oldType = shadowMap.type
            shadowMap.enabled = !!config.shadows

            if (typeof config.shadows === "boolean") {
              shadowMap.type = PCFSoftShadowMap
            } else if (typeof config.shadows === "string") {
              const types = {
                basic: BasicShadowMap,
                percentage: PCFShadowMap,
                soft: PCFSoftShadowMap,
                variance: VSMShadowMap,
              }
              shadowMap.type = types[config.shadows] ?? PCFSoftShadowMap
            } else if (typeof config.shadows === "object") {
              Object.assign(shadowMap, config.shadows)
            }

            if (oldEnabled !== shadowMap.enabled || oldType !== shadowMap.type) {
              shadowMap.needsUpdate = true
            }
          },
        )

        // Manage connecting XR
        whenRenderEffect(
          () => gl.xr,
          () => context.xr.connect(),
        )

        // Manage Props
        whenRenderEffect(
          () => !hasPluginMethod("gl") && !(config.gl instanceof WebGLRenderer) && config.gl,
          prop => useProps(gl, prop),
        )

        // Set color space and tonemapping preferences
        useProps(gl, {
          get outputEncoding() {
            return hasPluginMethod("linear")
              ? undefined
              : config.linear
              ? LinearEncoding
              : sRGBEncoding
          },
          get toneMapping() {
            return hasPluginMethod("flat")
              ? undefined
              : config.flat
              ? NoToneMapping
              : ACESFilmicToneMapping
          },
        })
      })
    }, [
      ...(props.contexts?.map(
        context => [context, null] as unknown as readonly [SolidContext<unknown>, unknown],
      ) ?? []),
      [threeContext, context],
      [pluginContext, plugins],
      [frameContext, addFrameListener],
    ])
  })

  // Return context merged with `addFrameListeners``
  // This is used in `@solid-three/testing`
  return mergeProps(context, { addFrameListener })
}
