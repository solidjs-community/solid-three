import { onCleanup } from "solid-js"
import { Object3D } from "three"
import { useThree } from "../hooks.ts"
import { plugin } from "../plugin.ts"
import type { Context, Plugin } from "../types.ts"
import { getMeta } from "../utils.ts"
import { getEngine, installEngine, warnOnIgnoredRaycaster, type RaycasterOption } from "./engine.ts"
import type { DispatchEvent } from "./pointers.ts"
import type { ScreenRaycaster } from "./raycasters.ts"
import type { EventHandlers, EventName, PointerEventMethods } from "./types.ts"

export type { RaycasterOption } from "./engine.ts"
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
 * The engine owns the raycaster: core has none. Configure it here, read and mutate it at
 * runtime with {@link useRaycaster}.
 *
 * @param options.raycaster - How this canvas picks. Either a whole ray strategy — a
 *   `ScreenRaycaster` instance such as `new CenterRaycaster()` for gaze input — or a plain
 *   config object of raycaster properties (`{ far: 10, near: 1 }`) applied to the engine's
 *   own `CursorRaycaster`. Defaults to an unconfigured `CursorRaycaster`. The option is
 *   read once, at install; runtime changes go through {@link useRaycaster}. Only the first
 *   `pointerEvents()` instance to install on a given canvas actually configures the engine
 *   — engine state is per-canvas, not per-instance. If several instances are in play (e.g.
 *   one listed on `<Canvas plugins>` and another on the namespace via
 *   `createT(THREE, [...])`), configure the raycaster on the instance you list on
 *   `<Canvas plugins>`: that's the one that installs, and every later instance's
 *   `raycaster` option is silently ignored (a DEV warning fires when it differs, but only
 *   when the ignored instance is also listed on `<Canvas plugins>` — a namespace-only
 *   instance's option can't be observed at all).
 */
export function pointerEvents(options?: { raycaster?: RaycasterOption }): PointerEventsPlugin {
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
    canvas: (context: Context) => {
      // A pure read: `install` (and the engine it sets up) is reached only through
      // `Context.initializePlugin`, which dedups by `token` — shared across every
      // `pointerEvents()` instance — so a second instance's `install` closure never
      // runs. Canvas-prop resolution, by contrast, runs unconditionally for every
      // plugin listed on `<Canvas plugins>`, so it's the one place a second instance's
      // `raycaster` option is reachable — hence the warning lives here, not in
      // `installEngine`.
      warnOnIgnoredRaycaster(context, options?.raycaster)
      return {
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
      }
    },
  })
}

/**
 * The raycaster this canvas picks with — the engine's own, and the only one there is.
 * Mutate it and picking changes on the next event:
 *
 * ```tsx
 * const raycaster = useRaycaster()
 * createEffect(() => (raycaster.far = reach()))
 * ```
 *
 * Must be called under a `<Canvas>` that has a `pointerEvents()` engine installed — there
 * is no raycaster otherwise, and handing back an inert one would silently do nothing.
 *
 * @throws If called outside a `<Canvas>`, or inside one with no engine installed.
 */
export function useRaycaster(): ScreenRaycaster {
  // Throws "S3: Hooks can only be used within the Canvas component!" outside a Canvas.
  const context = useThree()
  const engine = getEngine(context)
  if (!engine) {
    throw new Error(
      "S3: useRaycaster() needs the pointer-events engine, which owns the raycaster — " +
        "this Canvas has none installed. List it on the Canvas: " +
        "<Canvas plugins={[pointerEvents()]}> (or use createT.withCanvas). An engine listed " +
        "only on createT's namespace installs lazily, on the first element carrying a " +
        "handler, so it may not exist yet when this hook runs.",
    )
  }
  return engine.raycaster
}
