import { onCleanup, runWithOwner } from "solid-js"
import type { Intersection, Object3D } from "three"
import { Pointer } from "./pointers.ts"
import { ControllerRaycaster } from "./raycasters.tsx"
import type { Context, Plugin, ThreeEvent } from "./types.ts"
import { getMeta } from "./utils.ts"

/** The rich payload XR handlers receive. */
export type XRThreeEvent = ThreeEvent<XRInputSourceEvent> & {
  controller: Object3D
  inputSource: XRInputSource | undefined
  handedness: XRHandedness | undefined
  element: Object3D | undefined
  intersection: Intersection
}

/** A controller's `selectstart`/`selectend`/`squeezestart`/`squeezeend` event. */
type ControllerEvent = { type: string; data?: XRInputSource }

/**
 * The slice of `renderer.xr` this source drives: session-lifecycle events plus
 * `getController(i)`. A controller (an `Object3D` extending `EventDispatcher`)
 * structurally satisfies the listener half too.
 */
type XRLike = {
  getController(index: number): Object3D
  addEventListener(type: string, listener: () => void): void
  removeEventListener(type: string, listener: () => void): void
}

const PAIRS = [
  ["selectstart", "onXRSelectStart"],
  ["selectend", "onXRSelectEnd"],
  ["squeezestart", "onXRSqueezeStart"],
  ["squeezeend", "onXRSqueezeEnd"],
] as const

/**
 * Wires XR controllers as pointer sources for the duration of a session. On
 * `sessionstart`, each `getController(i)` (an `Object3D` whose `matrixWorld` aims
 * the ray AND which dispatches select/squeeze events) gets a `Pointer` + a
 * `ControllerRaycaster`; the four start/end events dispatch the matching handler,
 * enriched with `{ controller, inputSource, handedness }`. Bubbling + canvas-level
 * come from `Pointer.dispatch`. `sessionend` (or `connect`'s disconnect) tears the
 * controllers down. Replaces the controller wiring previously baked into core.
 */
export class XRControllerSource {
  constructor(
    private context: Context,
    private xr: XRLike,
    private count = 2,
  ) {}

  connect(): () => void {
    let controllerCleanups: Array<() => void> = []

    const wire = () => {
      for (let index = 0; index < this.count; index++) {
        const controller = this.xr.getController(index)
        const pointer = new Pointer(this.context, new ControllerRaycaster(controller))
        const listeners = PAIRS.map(([native, handler]) => {
          const listener = (event: ControllerEvent) => {
            const inputSource = event?.data
            pointer.dispatch(handler, new Event(native), {
              controller,
              inputSource,
              handedness: inputSource?.handedness,
            })
          }
          return [native, listener] as const
        })
        const target = controller as unknown as XRLike
        for (const [type, listener] of listeners) {
          target.addEventListener(type, listener as () => void)
        }
        controllerCleanups.push(() => {
          for (const [type, listener] of listeners) {
            target.removeEventListener(type, listener as () => void)
          }
        })
      }
    }

    const unwire = () => {
      for (const cleanup of controllerCleanups) cleanup()
      controllerCleanups = []
    }

    this.xr.addEventListener("sessionstart", wire)
    this.xr.addEventListener("sessionend", unwire)
    return () => {
      this.xr.removeEventListener("sessionstart", wire)
      this.xr.removeEventListener("sessionend", unwire)
      unwire()
    }
  }
}

/**********************************************************************************/
/*                                                                                */
/*                                  xrEvents plugin                               */
/*                                                                                */
/**********************************************************************************/

/** Per-context dedup token for the controller source (one source per `ctx`). */
const XR_SOURCE = Symbol("xr-controller-source")

/**
 * Reference count per registered element, so an element bearing several XR
 * handlers (or remounting) is added to / removed from `eventRegistry` exactly once.
 */
const refcounts = new WeakMap<Object3D, number>()

/** Add `element` to the context's `eventRegistry` (refcounted), removing on cleanup. */
function registerInRegistry(context: Context, element: Object3D) {
  const count = refcounts.get(element) ?? 0
  if (count === 0) context.eventRegistry.push(element)
  refcounts.set(element, count + 1)
  onCleanup(() => {
    const current = (refcounts.get(element) ?? 1) - 1
    if (current <= 0) {
      refcounts.delete(element)
      const index = context.eventRegistry.indexOf(element)
      if (index !== -1) context.eventRegistry.splice(index, 1)
    } else {
      refcounts.set(element, current)
    }
  })
}

/** Attach the controller source to a context's renderer for the Canvas's lifetime. */
function wireSource(context: Context) {
  const xr = (context.gl as { xr?: XRLike }).xr
  if (!xr || typeof xr.getController !== "function") return
  const disconnect = new XRControllerSource(context, xr).connect()
  onCleanup(disconnect)
}

/** The four handlers `xrEvents()` contributes — each typed to receive an {@link XRThreeEvent}. */
type XRHandler = (callback: (event: XRThreeEvent) => void) => void
type XRHandlers = {
  onXRSelectStart: XRHandler
  onXRSelectEnd: XRHandler
  onXRSqueezeStart: XRHandler
  onXRSqueezeEnd: XRHandler
}

/**
 * Plugin: composes XR controller events. `createT(THREE, [xrEvents()])` or
 * `<Entity plugins={[xrEvents()]}>`. Contributes `onXRSelectStart/End` +
 * `onXRSqueezeStart/End` — each a typed handler whose callback (the user's prop)
 * is dispatched by the controller source to the ray-hit mesh.
 *
 * A contributed method's job is registration, not storage: the callback already
 * rides on `getMeta(element).props.onXR…`, which `Pointer.dispatch` reads. The
 * method registers the element (so the controller ray can hit it) and wires the
 * source once per `ctx` via `initializePlugin` (rooted to the Canvas owner, so it
 * tears down with the Canvas).
 */
export function xrEvents(): Plugin<(element: Object3D) => XRHandlers> {
  return (element: Object3D) => {
    const register = () => {
      const ctx = getMeta(element)?.ctx
      if (!ctx) return
      registerInRegistry(ctx, element)
      const wire = () => ctx.initializePlugin(XR_SOURCE, () => wireSource(ctx))
      if (ctx.owner) runWithOwner(ctx.owner, wire)
      else wire()
    }
    return {
      onXRSelectStart: () => register(),
      onXRSelectEnd: () => register(),
      onXRSqueezeStart: () => register(),
      onXRSqueezeEnd: () => register(),
    }
  }
}
