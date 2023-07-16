import { createResizeObserver } from '@solid-primitives/resize-observer'
import { Accessor, JSX } from 'solid-js'
import { insert } from 'solid-js/web'
import * as THREE from 'three'
import { OffscreenCanvas } from 'three'

import { createLoop } from '../core/loop'
import { Lifecycle, Stage, Stages } from '../core/stages'
import { calculateDpr, dispose, is } from '../core/utils'
import { ParentContext, applyProps } from './components'
import { context } from './context'
import { createStore, isRenderer } from './store'

import type { ComputeFunction, EventManager } from '../core/events'
import type { Camera, EquConfig } from '../core/utils'
import type { Catalogue, Instance, Object3DNode, Root } from '../three-types'
import type { Dpr, Frameloop, Performance, PrivateKeys, Renderer, RootState, Size, Subscription } from './store'

type SolidThreeRoot = Root<RootState>

export const roots = new Map<Element, SolidThreeRoot>()
export const { invalidate, advance } = createLoop(roots)

const shallowLoose = { objects: 'shallow', strict: false } as EquConfig

type Properties<T> = Pick<T, { [K in keyof T]: T[K] extends (_: any) => any ? never : K }[keyof T]>

type GLProps =
  | Renderer
  | ((canvas: HTMLCanvasElement) => Renderer)
  | Partial<Properties<THREE.WebGLRenderer> | THREE.WebGLRendererParameters>
  | undefined

export type RenderProps<TCanvas extends Element> = {
  /** A threejs renderer instance or props that go into the default renderer */
  gl?: GLProps
  /** Dimensions to fit the renderer to. Will measure canvas dimensions if omitted */
  size?: Size
  /**
   * Enables PCFsoft shadows. Can accept `gl.shadowMap` options for fine-tuning.
   * @see https://threejs.org/docs/#api/en/renderers/WebGLRenderer.shadowMap
   */
  shadows?: boolean | Partial<THREE.WebGLShadowMap>
  /**
   * Disables three r139 color management.
   * @see https://threejs.org/docs/#manual/en/introduction/Color-management
   */
  legacy?: boolean
  /** Switch off automatic sRGB encoding and gamma correction */
  linear?: boolean
  /** Use `THREE.NoToneMapping` instead of `THREE.ACESFilmicToneMapping` */
  flat?: boolean
  /** Creates an orthographic camera */
  orthographic?: boolean
  /**
   * R3F's render mode. Set to `demand` to only render on state change or `never` to take control.
   * @see https://docs.pmnd.rs/react-three-fiber/advanced/scaling-performance#on-demand-rendering
   */
  frameloop?: Frameloop
  /**
   * R3F performance options for adaptive performance.
   * @see https://docs.pmnd.rs/react-three-fiber/advanced/scaling-performance#movement-regression
   */
  performance?: Partial<Omit<Performance, 'regress'>>
  /** Target pixel ratio. Can clamp between a range: `[min, max]` */
  dpr?: Dpr
  /** Props that go into the default raycaster */
  raycaster?: Partial<THREE.Raycaster>
  /** A `THREE.Camera` instance or props that go into the default camera */
  camera?: (
    | Camera
    | Partial<
        Object3DNode<THREE.Camera> & Object3DNode<THREE.PerspectiveCamera> & Object3DNode<THREE.OrthographicCamera>
      >
  ) & {
    /** Flags the camera as manual, putting projection into your own hands */
    manual?: boolean
  }
  /** An R3F event manager to manage elements' pointer events */
  events?: (store: RootState) => EventManager<HTMLElement>
  /** Callback after the canvas has rendered (but not yet committed) */
  onCreated?: (state: RootState) => void
  /** Response for pointer clicks that have missed any target */
  onPointerMissed?: (event: MouseEvent) => void
  /** Create a custom lifecycle of stages */
  stages?: Stage[]
  render?: 'auto' | 'manual'
}

const createRendererInstance = <TElement extends Element>(gl: GLProps, canvas: TElement): THREE.WebGLRenderer => {
  const customRenderer = (
    typeof gl === 'function' ? gl(canvas as unknown as HTMLCanvasElement) : gl
  ) as THREE.WebGLRenderer
  if (isRenderer(customRenderer)) return customRenderer
  else
    return new THREE.WebGLRenderer({
      powerPreference: 'high-performance',
      canvas: canvas,
      antialias: true,
      alpha: true,
      ...gl,
    })
}

const createStages = (stages: Stage[] | undefined, store: RootState) => {
  let subscribers: Subscription[]
  let subscription: Subscription

  const _stages = stages ?? Lifecycle

  if (!_stages.includes(Stages.Update)) throw 'The Stages.Update stage is required for R3F.'
  if (!_stages.includes(Stages.Render)) throw 'The Stages.Render stage is required for R3F.'

  store.set(({ internal }) => ({ internal: { ...internal, stages: _stages } }))

  // Add useFrame loop to update stage
  const frameCallback = (state: RootState, delta: number, frame?: XRFrame | undefined) => {
    subscribers = state.internal.subscribers
    for (let i = 0; i < subscribers.length; i++) {
      subscription = subscribers[i]
      subscription.ref(subscription.store, delta, frame)
    }
  }

  Stages.Update.add(frameCallback, store)

  // Add render callback to render stage
  const renderCallback = (state: RootState) => {
    if (state.internal.render === 'auto' && state.gl.render) state.gl.render(state.scene, state.camera)
  }
  Stages.Render.add(renderCallback, store)
}

export type ReconcilerRoot<TCanvas extends Element> = {
  configure: (config?: RenderProps<TCanvas>) => ReconcilerRoot<TCanvas>
  render: (props: { children: JSX.Element }) => RootState
  unmount: () => void
}

function isCanvas(maybeCanvas: unknown): maybeCanvas is HTMLCanvasElement {
  return maybeCanvas instanceof HTMLCanvasElement
}

function computeInitialSize(canvas: HTMLCanvasElement | OffscreenCanvas, defaultSize?: Size): Size {
  if (defaultSize) {
    return defaultSize
  }

  if (isCanvas(canvas) && canvas.parentElement) {
    const { width, height, top, left } = canvas.parentElement.getBoundingClientRect()

    return { width, height, top, left }
  }

  return { width: 0, height: 0, top: 0, left: 0 }
}

export function createRoot<TCanvas extends Element>(canvas: TCanvas): ReconcilerRoot<TCanvas> {
  // Check against mistaken use of createRoot
  const prevRoot = roots.get(canvas)
  const prevStore = prevRoot?.store

  if (prevRoot) console.warn('R3F.createRoot should only be called once!')

  // Report when an error was detected in a previous render
  // https://github.com/pmndrs/react-three-fiber/pull/2261
  const logRecoverableError =
    typeof reportError === 'function'
      ? // In modern browsers, reportError will dispatch an error event,
        // emulating an uncaught JavaScript error.
        reportError
      : // In older browsers and test environments, fallback to console.error.
        console.error

  // Create store
  const store = prevStore || createStore(invalidate, advance)
  // Map it
  if (!prevRoot) roots.set(canvas, { store })

  // Locals
  let onCreated: ((state: RootState) => void) | undefined
  let configured = false

  return {
    configure(props: RenderProps<TCanvas> = {}) {
      let {
        gl: glConfig,
        size: propsSize,
        events,
        onCreated: onCreatedCallback,
        shadows = false,
        linear = false,
        flat = false,
        legacy = false,
        orthographic = false,
        frameloop = 'always',
        dpr = [1, 2],
        performance,
        raycaster: raycastOptions,
        camera: cameraOptions,
        onPointerMissed,
        stages,
      } = props

      // Set up renderer (one time only!)
      let gl = store.gl
      if (!store.gl) store.set({ gl: (gl = createRendererInstance(glConfig, canvas)) })

      // Set up raycaster (one time only!)
      let raycaster = store.raycaster
      if (!raycaster) store.set({ raycaster: (raycaster = new THREE.Raycaster()) })

      // Set raycaster options
      const { params, ...options } = raycastOptions || {}
      if (!is.equ(options, raycaster, shallowLoose)) applyProps(raycaster as any, { ...options })
      if (!is.equ(params, raycaster.params, shallowLoose))
        applyProps(raycaster as any, { params: { ...raycaster.params, ...params } })

      // Create default camera (one time only!)
      if (!store.camera) {
        const isCamera = cameraOptions instanceof THREE.Camera
        const camera = isCamera
          ? (cameraOptions as Camera)
          : orthographic
          ? new THREE.OrthographicCamera(0, 0, 0, 0, 0.1, 1000)
          : new THREE.PerspectiveCamera(75, 0, 0.1, 1000)
        if (!isCamera) {
          camera.position.z = 5
          if (cameraOptions) applyProps(camera as any, cameraOptions as any)
          // Always look at center by default
          if (!cameraOptions?.rotation) camera.lookAt(0, 0, 0)
        }
        store.set({ camera })
      }

      // Set up XR (one time only!)
      if (!store.xr) {
        // Handle frame behavior in WebXR
        const handleXRFrame: XRFrameRequestCallback = (timestamp: number, frame?: XRFrame) => {
          if (store.frameloop === 'never') return
          advance(timestamp, true, store, frame)
        }

        // Toggle render switching on session
        const handleSessionChange = () => {
          store.gl.xr.enabled = store.gl.xr.isPresenting

          store.gl.xr.setAnimationLoop(store.gl.xr.isPresenting ? handleXRFrame : null)
          if (!store.gl.xr.isPresenting) invalidate(store)
        }

        // WebXR session manager
        const xr = {
          connect() {
            const gl = store.gl
            gl.xr.addEventListener('sessionstart', handleSessionChange)
            gl.xr.addEventListener('sessionend', handleSessionChange)
          },
          disconnect() {
            const gl = store.gl
            gl.xr.removeEventListener('sessionstart', handleSessionChange)
            gl.xr.removeEventListener('sessionend', handleSessionChange)
          },
        }

        // Subscribe to WebXR session events
        if (gl.xr) xr.connect()
        store.set({ xr })
      }

      // Set shadowmap
      if (gl.shadowMap) {
        const isBoolean = is.boo(shadows)
        if ((isBoolean && gl.shadowMap.enabled !== shadows) || !is.equ(shadows, gl.shadowMap, shallowLoose)) {
          const old = gl.shadowMap.enabled
          gl.shadowMap.enabled = !!shadows
          if (!isBoolean) Object.assign(gl.shadowMap, shadows)
          else gl.shadowMap.type = THREE.PCFSoftShadowMap
          if (old !== gl.shadowMap.enabled) gl.shadowMap.needsUpdate = true
        }
      }

      // Set color management
      ;(THREE as any).ColorManagement.legacyMode = legacy
      const outputEncoding = linear ? THREE.LinearEncoding : THREE.sRGBEncoding
      const toneMapping = flat ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping
      if (gl.outputEncoding !== outputEncoding) gl.outputEncoding = outputEncoding
      if (gl.toneMapping !== toneMapping) gl.toneMapping = toneMapping

      // Update color management state
      if (store.legacy !== legacy) store.set(() => ({ legacy }))
      if (store.linear !== linear) store.set(() => ({ linear }))
      if (store.flat !== flat) store.set(() => ({ flat }))

      // Set gl props
      if (glConfig && !is.fun(glConfig) && !isRenderer(glConfig) && !is.equ(glConfig, gl, shallowLoose))
        applyProps(gl as any, glConfig as any)
      // Store events internally
      if (events && !store.events.handlers) store.set({ events: { ...store.events, ...events(store) } })
      // Check pixelratio
      if (dpr && store.viewport.dpr !== calculateDpr(dpr)) store.setDpr(dpr)
      // Check size, allow it to take on container bounds initially
      const size = computeInitialSize(canvas, propsSize)
      if (!is.equ(size, store.size, shallowLoose)) {
        store.setSize(size.width, size.height, size.updateStyle, size.top, size.left)
      }
      // Check frameloop
      if (store.frameloop !== frameloop) store.setFrameloop(frameloop)
      // Check pointer missed
      if (!store.onPointerMissed) store.set({ onPointerMissed })
      // Check performance
      if (performance && !is.equ(performance, store.performance, shallowLoose))
        store.set((state) => ({ performance: { ...state.performance, ...performance } }))

      // Create update stages. Only do this once on init
      if (store.internal.stages.length === 0) createStages(stages, store)

      // Set locals
      onCreated = onCreatedCallback
      configured = true

      return this
    },
    render(props: { children: JSX.Element }) {
      // The root has to be configured before it can be rendered
      if (!configured) this.configure()

      createResizeObserver(
        () => canvas.parentElement!,
        ({ width, height }) => {
          store.setSize(width, height)
        },
      )

      insert(canvas.parentElement!, () => (
        <Provider store={store} rootElement={canvas} onCreated={onCreated}>
          <ParentContext.Provider value={() => store.scene as unknown as Instance}>
            {[store.gl.domElement, props.children]}
          </ParentContext.Provider>
        </Provider>
      ))

      return store
    },
    unmount() {
      unmountComponentAtNode(canvas)
    },
  }
}

export function render<TCanvas extends Element>(
  children: JSX.Element,
  canvas: TCanvas,
  config: RenderProps<TCanvas>,
): RootState {
  console.warn('R3F.render is no longer supported in React 18. Use createRoot instead!')
  const root = createRoot(canvas)
  root.configure(config)
  return root.render({ children })
}

function Provider<TElement extends Element>(props: {
  onCreated?: (state: RootState) => void
  store: RootState
  children: JSX.Element
  rootElement: TElement
  parent?: Accessor<TElement | undefined>
}) {
  // Flag the canvas active, rendering will now begin
  props.store.set((state) => ({ internal: { ...state.internal, active: true } }))
  // Notifiy that init is completed, the scene graph exists, but nothing has yet rendered

  // NOTE:  Without untrack we get a `RangeError: Maximum Call Stack Size Exceeded`-error
  //        In the original r3f-code it is an IsomorphicLayoutEffect with empty dependency-array
  //        But using onMount did not create the wanted results.
  if (props.onCreated) props.onCreated!(props.store)

  // Connect events to the targets parent, this is done to ensure events are registered on
  // a shared target, and not on the canvas itself
  if (!props.store.events.connected) props.store.events.connect?.(props.rootElement)

  return <context.Provider value={props.store}>{props.children}</context.Provider>
}

export function unmountComponentAtNode<TElement extends Element>(
  canvas: TElement,
  callback?: (canvas: TElement) => void,
) {
  const root = roots.get(canvas)
  const state = root?.store
  if (state) {
    state.internal.active = false

    setTimeout(() => {
      try {
        state.events.disconnect?.()
        state.gl?.renderLists?.dispose?.()
        state.gl?.forceContextLoss?.()
        if (state.gl?.xr) state.xr.disconnect()
        dispose(state)
        roots.delete(canvas)
        if (callback) callback(canvas)
      } catch (e) {
        /* ... */
      }
    }, 500)
  }
}

export type InjectState = Partial<
  Omit<RootState, PrivateKeys> & {
    events?: {
      enabled?: boolean
      priority?: number
      compute?: ComputeFunction
      connected?: any
    }
    size?: Size
  }
>

// function createPortal(children: JSX.Element, container: THREE.Object3D, state?: InjectState): JSX.Element {
//   return <Portal key={container.uuid} children={children} container={container} state={state} />
// }

// function Portal({
//   state = {},
//   children,
//   container,
// }: {
//   children: JSX.Element
//   state?: InjectState
//   container: THREE.Object3D
// }) {
//   /** This has to be a component because it would not be able to call useThree/useStore otherwise since
//    *  if this is our environment, then we are not in r3f's renderer but in react-dom, it would trigger
//    *  the "R3F hooks can only be used within the Canvas component!" warning:
//    *  <Canvas>
//    *    {createPortal(...)} */

//   const { events, size, ...rest } = state
//   const previousRoot = useStore()
//   const [raycaster] = React.useState(() => new THREE.Raycaster())
//   const [pointer] = React.useState(() => new THREE.Vector2())

//   const inject = React.useCallback(
//     (rootState: RootState, injectState: RootState) => {
//       const intersect: Partial<RootState> = { ...rootState } // all prev state props

//       // Only the fields of "rootState" that do not differ from injectState
//       // Some props should be off-limits
//       // Otherwise filter out the props that are different and let the inject layer take precedence
//       Object.keys(rootState).forEach((key) => {
//         if (
//           // Some props should be off-limits
//           privateKeys.includes(key as PrivateKeys) ||
//           // Otherwise filter out the props that are different and let the inject layer take precedence
//           rootState[key as keyof RootState] !== injectState[key as keyof RootState]
//         ) {
//           delete intersect[key as keyof RootState]
//         }
//       })

//       let viewport = undefined
//       if (injectState && size) {
//         const camera = injectState.camera
//         // Calculate the override viewport, if present
//         viewport = rootState.viewport.getCurrentViewport(camera, new THREE.Vector3(), size)
//         // Update the portal camera, if it differs from the previous layer
//         if (camera !== rootState.camera) updateCamera(camera, size)
//       }

//       return {
//         // The intersect consists of the previous root state
//         ...intersect,
//         // Portals have their own scene, which forms the root, a raycaster and a pointer
//         scene: container as THREE.Scene,
//         raycaster,
//         pointer,
//         mouse: pointer,
//         // Their previous root is the layer before it
//         previousRoot,
//         // Events, size and viewport can be overridden by the inject layer
//         events: { ...rootState.events, ...injectState?.events, ...events },
//         size: { ...rootState.size, ...size },
//         viewport: { ...rootState.viewport, ...viewport },
//         ...rest,
//       } as RootState
//     },
//     [state],
//   )

//   const [usePortalStore] = React.useState(() => {
//     // Create a mirrored store, based on the previous root with a few overrides ...
//     const previousState = previousRoot
//     const store = create<RootState>((set, get) => ({
//       ...previousState,
//       scene: container as THREE.Scene,
//       raycaster,
//       pointer,
//       mouse: pointer,
//       previousRoot,
//       events: { ...previousState.events, ...events },
//       size: { ...previousState.size, ...size },
//       ...rest,
//       // Set and get refer to this root-state
//       set,
//       get,
//       // Layers are allowed to override events
//       setEvents: (events: Partial<EventManager<any>>) =>
//         set((state) => ({ ...state, events: { ...state.events, ...events } })),
//     }))
//     return store
//   })

//   React.useEffect(() => {
//     // Subscribe to previous root-state and copy changes over to the mirrored portal-state
//     const unsub = previousRoot.subscribe((prev) => usePortalStore.setState((state) => inject(prev, state)))
//     return () => {
//       unsub()
//       usePortalStore.destroy()
//     }
//   }, [])

//   React.useEffect(() => {
//     usePortalStore.setState((injectState) => inject(previousRoot, injectState))
//   }, [inject])

//   return (
//     <>
//       {reconciler.createPortal(
//         <context.Provider value={usePortalStore}>{children}</context.Provider>,
//         usePortalStore,
//         null,
//       )}
//     </>
//   )
// }

// reconciler.injectIntoDevTools({
//   bundleType: process.env.NODE_ENV === 'production' ? 0 : 1,
//   rendererPackageName: '@react-three/fiber',
//   version: React.version,
// })

let catalogue: Catalogue = {}
export const extend = (objects: object): void => void (catalogue = { ...catalogue, ...objects })
