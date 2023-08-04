import { createResizeObserver } from '@solid-primitives/resize-observer'
import { createEffect, createMemo, splitProps, type JSX } from 'solid-js'
import { createStore } from 'solid-js/store'
import * as THREE from 'three'

import { useThree } from './hooks'
import { createLoop } from './loop'
import { parentChildren } from './proxy'
import { context, createThreeStore, isRenderer } from './store'
import { applyProps, calculateDpr, dispose, getColorManagement, is, prepare, updateCamera } from './utils'

import { insert } from 'solid-js/web'
import type { Root, ThreeElement } from '../three-types'
import { withContext } from '../utils/withContext'
import type { ComputeFunction, EventManager } from './events'
import type { Dpr, Frameloop, Performance, Renderer, RootState, Size } from './store'
import type { Camera, EquConfig } from './utils'

// TODO: fix type resolve
declare var OffscreenCanvas: any
type OffscreenCanvas = any

type Canvas = HTMLCanvasElement | OffscreenCanvas

export const roots = new Map<Canvas, Root>()
export const { advance, invalidate } = createLoop(roots)

const shallowLoose = { objects: 'shallow', strict: false } as EquConfig

type Properties<T> = Pick<T, { [K in keyof T]: T[K] extends (_: any) => any ? never : K }[keyof T]>

export type GLProps =
  | Renderer
  | ((canvas: Canvas) => Renderer)
  | Partial<Properties<THREE.WebGLRenderer> | THREE.WebGLRendererParameters>

export type CameraProps = (
  | Camera
  | Partial<
      ThreeElement<typeof THREE.Camera> &
        ThreeElement<typeof THREE.PerspectiveCamera> &
        ThreeElement<typeof THREE.OrthographicCamera>
    >
) & {
  /** Flags the camera as manual, putting projection into your own hands */
  manual?: boolean
}

export interface RenderProps<TCanvas extends Canvas> {
  /** A threejs renderer instance or props that go into the default renderer */
  gl?: GLProps
  /** Dimensions to fit the renderer to. Will measure canvas dimensions if omitted */
  size?: Size
  /**
   * Enables shadows (by default PCFsoft). Can accept `gl.shadowMap` options for fine-tuning,
   * but also strings: 'basic' | 'percentage' | 'soft' | 'variance'.
   * @see https://threejs.org/docs/#api/en/renderers/WebGLRenderer.shadowMap
   */
  shadows?: boolean | 'basic' | 'percentage' | 'soft' | 'variance' | Partial<THREE.WebGLShadowMap>
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
  /** A `THREE.Scene` instance or props that go into the default scene */
  scene?: THREE.Scene | Partial<THREE.Scene>
  /** A `THREE.Camera` instance or props that go into the default camera */
  camera?: CameraProps
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

const createRendererInstance = <TCanvas extends Canvas>(
  gl: GLProps | undefined,
  canvas: TCanvas,
): THREE.WebGLRenderer => {
  const customRenderer = (typeof gl === 'function' ? gl(canvas) : gl) as THREE.WebGLRenderer
  if (isRenderer(customRenderer)) return customRenderer

  return new THREE.WebGLRenderer({
    powerPreference: 'high-performance',
    canvas: canvas as HTMLCanvasElement,
    antialias: true,
    alpha: true,
    ...gl,
  })
}

export interface ReconcilerRoot<TCanvas extends Canvas> {
  configure: (config?: RenderProps<TCanvas>) => ReconcilerRoot<TCanvas>
  // s3f    solid-three has to pass the element to render as { children: JSX.Element }
  //        otherwise we would have to do .render(props.children) inside Canvas
  //        which would cause the children to be resolved too early.
  render: (props: { children: JSX.Element }) => RootState
  unmount: () => void
}

function computeInitialSize(canvas: Canvas, size?: Size): Size {
  if (!size && canvas instanceof HTMLCanvasElement && canvas.parentElement) {
    const { width, height, top, left } = canvas.parentElement.getBoundingClientRect()
    return { width, height, top, left }
  } else if (!size && typeof OffscreenCanvas !== 'undefined' && canvas instanceof OffscreenCanvas) {
    return {
      width: canvas.width,
      height: canvas.height,
      top: 0,
      left: 0,
    }
  }

  return { width: 0, height: 0, top: 0, left: 0, ...size }
}

export function createRoot<TCanvas extends Canvas>(canvas: TCanvas): ReconcilerRoot<TCanvas> {
  // Check against mistaken use of createRoot
  const prevRoot = roots.get(canvas)
  const prevStore = prevRoot?.store

  if (prevRoot) console.warn('R3F.createRoot should only be called once!')

  // Create store
  const store = prevStore || createThreeStore(invalidate, advance)
  // Map it
  if (!prevRoot) roots.set(canvas, { store })

  // Locals
  let onCreated: ((state: RootState) => void) | undefined
  let configured = false
  let lastCamera: RenderProps<TCanvas>['camera']

  return {
    configure(props: RenderProps<TCanvas> = {}): ReconcilerRoot<TCanvas> {
      let {
        gl: glConfig,
        size: propsSize,
        scene: sceneOptions,
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
      if (!store.gl) store.set('gl', (gl = createRendererInstance(glConfig, canvas)))

      // Set up raycaster (one time only!)
      let raycaster = store.raycaster
      if (!raycaster) store.set('raycaster', (raycaster = new THREE.Raycaster()))

      // Set raycaster options
      const { params, ...options } = raycastOptions || {}
      if (!is.equ(options, raycaster, shallowLoose)) applyProps(raycaster, { ...options })
      if (!is.equ(params, raycaster.params, shallowLoose))
        applyProps(raycaster, { params: { ...raycaster.params, ...params } })

      // Create default camera, don't overwrite any user-set state
      if (!store.camera || (store.camera === lastCamera && !is.equ(lastCamera, cameraOptions, shallowLoose))) {
        lastCamera = cameraOptions
        const isCamera = cameraOptions instanceof THREE.Camera
        const camera = isCamera
          ? (cameraOptions as Camera)
          : orthographic
          ? new THREE.OrthographicCamera(0, 0, 0, 0, 0.1, 1000)
          : new THREE.PerspectiveCamera(75, 0, 0.1, 1000)
        if (!isCamera) {
          camera.position.z = 5
          if (cameraOptions) applyProps(camera, cameraOptions as any)
          // Always look at center by default
          if (!store.camera && !cameraOptions?.rotation) camera.lookAt(0, 0, 0)
        }
        store.set('camera', camera)
      }

      // Set up scene (one time only!)
      if (!store.scene) {
        let scene: THREE.Scene

        if (sceneOptions instanceof THREE.Scene) {
          scene = sceneOptions
          prepare(scene, store, '', {})
        } else {
          scene = new THREE.Scene()
          prepare(scene, store, '', {})
          if (sceneOptions) applyProps(scene as any, sceneOptions as any)
        }

        store.set('scene', scene)
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
        store.set('xr', xr)
      }

      // Set shadowmap
      if (gl.shadowMap) {
        const oldEnabled = gl.shadowMap.enabled
        const oldType = gl.shadowMap.type
        gl.shadowMap.enabled = !!shadows

        if (is.boo(shadows)) {
          gl.shadowMap.type = THREE.PCFSoftShadowMap
        } else if (is.str(shadows)) {
          const types = {
            basic: THREE.BasicShadowMap,
            percentage: THREE.PCFShadowMap,
            soft: THREE.PCFSoftShadowMap,
            variance: THREE.VSMShadowMap,
          }
          gl.shadowMap.type = types[shadows] ?? THREE.PCFSoftShadowMap
        } else if (is.obj(shadows)) {
          Object.assign(gl.shadowMap, shadows)
        }

        if (oldEnabled !== gl.shadowMap.enabled || oldType !== gl.shadowMap.type) gl.shadowMap.needsUpdate = true
      }

      // Safely set color management if available.
      // Avoid accessing THREE.ColorManagement to play nice with older versions
      const ColorManagement = getColorManagement()
      if (ColorManagement) {
        if ('enabled' in ColorManagement) ColorManagement.enabled = !legacy
        else if ('legacyMode' in ColorManagement) ColorManagement.legacyMode = legacy
      }

      // Set color space and tonemapping preferences
      const LinearEncoding = 3000
      const sRGBEncoding = 3001
      applyProps(
        gl as any,
        {
          outputEncoding: linear ? LinearEncoding : sRGBEncoding,
          toneMapping: flat ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping,
        } as Partial<Properties<THREE.WebGLRenderer>>,
      )

      // Update color management state
      if (store.legacy !== legacy) store.set('legacy', legacy)
      if (store.linear !== linear) store.set('linear', linear)
      if (store.flat !== flat) store.set('flat', flat)

      // Set gl props
      if (glConfig && !is.fun(glConfig) && !isRenderer(glConfig) && !is.equ(glConfig, gl, shallowLoose))
        applyProps(gl, glConfig as any)
      // Store events internally
      if (events && !store.events.handlers) store.set('events', events(store))

      // Check size, allow it to take on container bounds initially
      const size = computeInitialSize(canvas, propsSize)
      if (!is.equ(size, store.size, shallowLoose)) {
        store.setSize(size.width, size.height, size.top, size.left)
      }
      // Check pixelratio
      if (dpr && store.viewport.dpr !== calculateDpr(dpr)) store.setDpr(dpr)
      // Check frameloop
      if (store.frameloop !== frameloop) store.setFrameloop(frameloop)
      // Check pointer missed
      if (!store.onPointerMissed) store.set('onPointerMissed', onPointerMissed)
      // Check performance
      if (performance && !is.equ(performance, store.performance, shallowLoose)) store.set('performance', performance)

      // Set locals
      onCreated = onCreatedCallback
      configured = true

      return this
    },
    render(props) {
      // The root has to be configured before it can be rendered
      if (!configured) this.configure()

      // s3f:  this code will break when used in a worker.
      createResizeObserver(
        () => canvas.parentElement!,
        ({ width, height }) => {
          store.setSize(width, height)
        },
      )

      // s3f    children of <Canvas/> are being attached to the Instance<typeof store.scene>
      parentChildren(() => store.scene, {
        children: (
          <Provider store={store} rootElement={canvas} onCreated={onCreated}>
            {props.children}
          </Provider>
        ),
      })

      // s3f:  this code will break when used in a worker.
      insert(canvas.parentElement!, store.gl.domElement)

      return store
    },
    unmount() {
      unmountComponentAtNode(canvas)
    },
  }
}

export function render<TCanvas extends Canvas>(
  children: JSX.Element,
  canvas: TCanvas,
  config: RenderProps<TCanvas>,
): RootState {
  console.warn('R3F.render is no longer supported in React 18. Use createRoot instead!')
  const root = createRoot(canvas)
  root.configure(config)
  return root.render({ children })
}

interface ProviderProps<TCanvas extends Canvas> {
  onCreated?: (state: RootState) => void
  store: RootState
  children: JSX.Element
  rootElement: TCanvas
}

function Provider<TCanvas extends Canvas>(props: ProviderProps<TCanvas>): JSX.Element {
  // Flag the canvas active, rendering will now begin
  props.store.set('internal', 'active', true)
  // Notifiy that init is completed, the scene graph exists, but nothing has yet rendered
  if (props.onCreated) props.onCreated(props.store)
  // Connect events to the targets parent, this is done to ensure events are registered on
  // a shared target, and not on the canvas itself
  if (!props.store.events.connected) props.store.events.connect?.(props.rootElement)
  return <context.Provider value={props.store}>{props.children}</context.Provider>
}

export function unmountComponentAtNode<TCanvas extends Canvas>(
  canvas: TCanvas,
  callback?: (canvas: TCanvas) => void,
): void {
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
        dispose(state.scene)
        roots.delete(canvas)
        if (callback) callback(canvas)
      } catch (e) {
        /* ... */
      }
    }, 500)
  }
}

export type InjectState = Partial<
  Omit<RootState, 'events'> & {
    events?: {
      enabled?: boolean
      priority?: number
      compute?: ComputeFunction
      connected?: any
    }
  }
>

export function createPortal(children: JSX.Element, container: THREE.Object3D, state?: InjectState): JSX.Element {
  return <Portal children={children} container={container} state={state} />
}

interface PortalProps {
  children: JSX.Element
  state?: InjectState
  container: THREE.Object3D
}

export function Portal(props: PortalProps) {
  const [state, rest] = splitProps(props.state || {}, ['events', 'size'])
  const previousRoot = useThree()
  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()

  const store = useThree()
  const scene = prepare(props.container || store.scene, store, '', {})

  const inject = (rootState: RootState, injectState: RootState) => {
    let viewport
    if (injectState.camera && state.size) {
      const camera = injectState.camera
      // Calculate the override viewport, if present
      viewport = rootState.viewport.getCurrentViewport(camera, new THREE.Vector3(), state.size)
      // Update the portal camera, if it differs from the previous layer
      if (camera !== rootState.camera) updateCamera(camera, state.size)
    }

    return {
      // The intersect consists of the previous root state
      ...rootState,
      set: injectState.set,
      // Portals have their own scene, which forms the root, a raycaster and a pointer
      scene: props.container as THREE.Scene,
      raycaster,
      pointer,
      mouse: pointer,
      // Their previous root is the layer before it
      previousRoot,
      // Events, size and viewport can be overridden by the inject layer
      events: { ...rootState.events, ...injectState.events, ...state.events },
      size: { ...rootState.size, ...state.size },
      viewport: { ...rootState.viewport, ...viewport },
      // Layers are allowed to override events
      setEvents: (events: Partial<EventManager<any>>) =>
        injectState.set((state) => ({ ...state, events: { ...state.events, ...events } })),
    } as RootState
  }

  // SOLID-THREE-NOTE:  I am unsure if this will work in solid since the original code
  //                    relied on subscribing aka deep-tracking rootState
  const usePortalStore = createMemo(() => {
    //@ts-ignore
    const set = (...args) => setStore(...args)
    const [store, setStore] = createStore<RootState>({ ...rest, set } as RootState)
    const onMutate = (prev: RootState) => store.set((state) => inject(prev, state))
    createEffect(() => onMutate(previousRoot))
    return store
  })

  const memo = createMemo(withContext(() => props.children, context, usePortalStore()))

  parentChildren(() => scene.object, {
    get children() {
      return memo()
    },
  })

  return <></>
}
