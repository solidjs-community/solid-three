import { onCleanup } from "solid-js"
import { Object3D } from "three"
import { plugin } from "../plugin.ts"
import type { Context, Plugin } from "../types.ts"
import { getMeta } from "../utils.ts"
import { getEngine, installEngine } from "./engine.ts"
import type { DispatchEvent } from "./pointers.ts"
import type { ScreenRaycaster } from "./raycasters.ts"
import type { EventHandlers, EventName, PointerEventMethods } from "./types.ts"

export { createThreeEvent, Pointer, type PointerEngine, type PointerRaycaster } from "./pointers.ts"
export { hasPointerCapture } from "./pointer-capture.ts"
export * from "./raycasters.ts"
export type {
  EventHandlers,
  EventHandlersMap,
  EventName,
  PointerCapture,
  PointerEventMethods,
  ThreeEvent,
} from "./types.ts"

/** Stable per-engine identity. Module-level: two `pointerEvents()` instances install once. */
const POINTER_EVENTS_TOKEN = Symbol("solid-three/events")

/**
 * What {@link pointerEvents} returns. The `canvas` static has to be spelled out
 * concretely (rather than left to the optional, `Record`-typed one on `PluginStatics`):
 * `CanvasPropsOf` reads the contributed canvas props off exactly this signature, and a
 * plain `Plugin<…>` return type would erase it — `<Canvas onPointerMissed>` would then
 * be an unknown prop.
 */
export type PointerEventsPlugin = Plugin<(element: Object3D) => PointerEventMethods> & {
  canvas: (context: Context) => {
    onPointerMissed: (handler: EventHandlers["onPointerMissed"]) => void
  }
}

const EVENT_NAMES = [
  "onClick",
  "onDoubleClick",
  "onContextMenu",
  "onPointerUp",
  "onPointerDown",
  "onPointerMove",
  "onPointerEnter",
  "onPointerLeave",
  "onWheel",
  "onPointerMissed",
] as const satisfies readonly EventName[]

/**
 * The r3f-faithful pointer engine. Install it into a namespace to give its elements
 * pointer handlers: `createT(THREE, [pointerEvents()])`. Without it, `onClick` is not
 * a prop of `T.Mesh` — a compile error, not a silently dead handler.
 *
 * The canvas-level `onPointerMissed` (the void signal, fired only on a total miss) is
 * contributed to `<Canvas>` — so the engine must also be listed there, either with
 * `<Canvas plugins={[engine]}>` or through `createT.withCanvas`.
 *
 * @param options.raycaster - Ray strategy for the screen pointer (e.g. a
 *   `CenterRaycaster` for gaze input). Defaults to the canvas's raycaster when that is
 *   a screen raycaster, else a fresh `CursorRaycaster`.
 */
export function pointerEvents(options?: { raycaster?: ScreenRaycaster }): PointerEventsPlugin {
  const base = plugin([Object3D], (object: Object3D) => {
    const methods = {} as Record<EventName, (handler: EventHandlers[EventName]) => void>
    for (const name of EVENT_NAMES) {
      // A handler prop only ever enters the object into the registry — the handler
      // itself is read back off `getMeta(object).props` at dispatch time, so a
      // reactive swap needs no re-registration.
      methods[name] = (handler: EventHandlers[EventName]) => {
        // The prop's runtime value is whatever the user passed — often a signal read
        // that is momentarily undefined — so an absent handler simply doesn't register.
        if (typeof handler !== "function") return
        const context = getMeta(object)?.ctx
        if (!context) return
        const engine = getEngine(context)
        if (!engine) return
        onCleanup(engine.register(object, name))
      }
    }
    return methods
  })

  return Object.assign(base, {
    token: POINTER_EVENTS_TOKEN,
    install: (context: Context) => installEngine(context, options?.raycaster),
    canvas: (context: Context) => ({
      onPointerMissed: (handler: EventHandlers["onPointerMissed"]) => {
        const engine = getEngine(context)
        if (!engine) return
        // As above: the prop's runtime value can be undefined (an unset canvas prop),
        // which clears the handler rather than installing a non-function.
        //
        // The cast bridges the dispatcher's internal event to the public one. The
        // `Pointer` builds a `DispatchEvent`, whose `nativeEvent` is typed as the
        // widest `Event` because one dispatcher serves every gesture; the miss is only
        // ever fired from the click family, so the `MouseEvent` the handler declares is
        // what actually arrives.
        engine.onPointerMissed =
          typeof handler === "function"
            ? (handler as unknown as (event: DispatchEvent) => void)
            : undefined
      },
    }),
  })
}
