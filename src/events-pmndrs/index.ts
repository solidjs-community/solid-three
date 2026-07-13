import {
  forwardHtmlEvents,
  type PointerEvent as PmndrsPointerEvent,
  type WheelEvent as PmndrsWheelEvent,
} from "@pmndrs/pointer-events"
import { onCleanup } from "solid-js"
import { Object3D } from "three"
import { plugin } from "../plugin.ts"
import type { Context, Plugin } from "../types.ts"

/**
 * Stable per-engine identity. Module-level: two `pmndrsEvents()` instances install once.
 */
const PMNDRS_EVENTS_TOKEN = Symbol("solid-three/events-pmndrs")

/**
 * Contributed prop name -> the event type `@pmndrs/pointer-events` dispatches on three's
 * `EventDispatcher`.
 *
 * pmndrs keeps no registry of its own. It traverses the scene and treats an object as a
 * pointer target exactly when that object carries a listener for one of these types —
 * `pointerEvents: "listener"` is its default. So "register a handler" and "add an event
 * listener" are the same act, which is why this engine needs no per-element state and
 * never reads `getMeta(object).ctx`.
 */
const POINTER_EVENT_TYPES = {
  onClick: "click",
  onDoubleClick: "dblclick",
  onContextMenu: "contextmenu",
  onPointerDown: "pointerdown",
  onPointerUp: "pointerup",
  onPointerMove: "pointermove",
  onPointerCancel: "pointercancel",
  onPointerOver: "pointerover",
  onPointerOut: "pointerout",
  onPointerEnter: "pointerenter",
  onPointerLeave: "pointerleave",
} as const

const WHEEL_EVENT_TYPES = {
  onWheel: "wheel",
} as const

/** Every three event type this engine listens for. */
type PmndrsEventType =
  | (typeof POINTER_EVENT_TYPES)[keyof typeof POINTER_EVENT_TYPES]
  | (typeof WHEEL_EVENT_TYPES)[keyof typeof WHEEL_EVENT_TYPES]

/**
 * The handler signatures the contributed props accept. Note the event is pmndrs' own
 * `PointerEvent` — an engine defines its own event shape, and this one is nothing like
 * the reference engine's `ThreeEvent`. That divergence is the point: the boundary carries
 * prop names and handler values, not one blessed event type.
 */
export type PmndrsEventHandlers = {
  [Prop in keyof typeof POINTER_EVENT_TYPES]: (event: PmndrsPointerEvent) => void
} & {
  [Prop in keyof typeof WHEEL_EVENT_TYPES]: (event: PmndrsWheelEvent) => void
}

/** The methods the plugin contributes: each takes the prop's value — the handler. */
export type PmndrsEventMethods = {
  [Prop in keyof PmndrsEventHandlers]: (handler: PmndrsEventHandlers[Prop]) => void
}

/**
 * three types `addEventListener` per event key, and this engine registers a key it only
 * knows as a union. Widen the dispatcher once, here, rather than casting at each of the
 * twelve contributed methods.
 */
type EventDispatcherView = {
  addEventListener(type: PmndrsEventType, listener: (event: never) => void): void
  removeEventListener(type: PmndrsEventType, listener: (event: never) => void): void
}

/**
 * The engine's one-time per-context setup, run by `Context.initializePlugin` under the
 * Canvas's owner — so `onCleanup` here tears the forwarder down when the Canvas unmounts,
 * not when whichever element happened to install it first goes away.
 *
 * `forwardHtmlEvents` attaches the canvas listeners (pointermove/down/up/cancel/leave,
 * pointerover, wheel — note: NOT `click`, which pmndrs synthesises itself from a
 * down/up pair) and returns an `update()` that must be pumped once a frame. That pump is
 * the whole reason `Context.addFrameListener` has to exist on the boundary: a plugin has
 * no Solid context to call `useFrame` from.
 *
 * Reachable ONLY through `Context.initializePlugin`, which dedups by `token` — so this
 * deliberately keeps no "already installed?" guard of its own. If the boundary ever
 * double-installed, this engine would double-dispatch, and the tests would say so.
 */
function install(context: Context) {
  const { update, destroy } = forwardHtmlEvents(context.canvas, () => context.camera, context.scene)
  onCleanup(context.addFrameListener(() => update()))
  onCleanup(destroy)
}

/**
 * A second event engine, wrapping `@pmndrs/pointer-events` — the package TresJS v5 uses.
 * It exists to prove the plugin boundary hosts an engine solid-three does not own, and it
 * is a deliberate foil for {@link pointerEvents}: everything about how it dispatches
 * differs, and none of that difference reaches core.
 *
 * The sharpest divergence is the void. `pointerEvents()` contributes a canvas prop
 * (`<Canvas onPointerMissed>`) because a miss is, for it, the absence of a hit. pmndrs
 * MATERIALISES the void: `getVoidObject(scene)` is a real `Mesh` whose `parent` is the
 * scene without ever being `add`ed, so events bubble through it while it is never
 * traversed or rendered — and a miss is simply an intersection whose object IS that mesh.
 * "Clicked empty space" is therefore an ordinary object-level listener here, and this
 * engine contributes NO canvas prop at all:
 *
 * ```ts
 * getVoidObject(context.scene).addEventListener("click", handleMiss)
 * ```
 *
 * Known quirks, inherited from the package and deliberately not worked around:
 * - it patches `Object3D.prototype` with `setPointerCapture` / `releasePointerCapture` /
 *   `hasPointerCapture` at import time — a process-global mutation, shared by every
 *   scene in the page, engine or not;
 * - its per-scene void-object cache is a module-level `Map` that is never cleaned up, so
 *   a disposed scene stays reachable through it;
 * - `forwardHtmlEvents` takes the canvas's NATIVE pointer capture directly
 *   (`forwardPointerCapture` defaults to `true`), rather than asking anyone for it.
 */
export function pmndrsEvents(): Plugin<(element: Object3D) => PmndrsEventMethods> {
  const base = plugin([Object3D], (object: Object3D) => {
    const methods = {} as Record<string, (handler: unknown) => void>
    const dispatcher = object as unknown as EventDispatcherView

    for (const [propName, eventType] of Object.entries({
      ...POINTER_EVENT_TYPES,
      ...WHEEL_EVENT_TYPES,
    }) as [string, PmndrsEventType][]) {
      methods[propName] = (handler: unknown) => {
        // The prop's runtime value is whatever the user passed — often a signal read that
        // is momentarily undefined — so an absent handler simply doesn't register.
        if (typeof handler !== "function") return
        const listener = handler as (event: never) => void
        dispatcher.addEventListener(eventType, listener)
        onCleanup(() => dispatcher.removeEventListener(eventType, listener))
      }
    }

    return methods as unknown as PmndrsEventMethods
  })

  return Object.assign(base, {
    token: PMNDRS_EVENTS_TOKEN,
    install,
  })
}
