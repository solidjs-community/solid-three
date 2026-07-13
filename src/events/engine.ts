import { onCleanup } from "solid-js"
import type { Object3D, Raycaster } from "three"
import { Stack } from "../data-structure/stack.ts"
import { useProps } from "../props.ts"
import type { BaseProps, Context } from "../types.ts"
import { captureRegistry } from "./pointer-capture.ts"
import { DOMPointerManager } from "./pointer-managers.ts"
import type { DispatchEvent, PointerEngine } from "./pointers.ts"
import { CursorRaycaster, type ScreenRaycaster } from "./raycasters.ts"
import type { EventName } from "./types.ts"

/**
 * The `raycaster` option of `pointerEvents()`. Either form configures the ONE raycaster
 * the engine picks with — core holds none:
 *
 * - a {@link ScreenRaycaster} INSTANCE — a whole ray strategy, e.g. `new CenterRaycaster()`
 *   for gaze input. The engine picks with that object itself.
 * - a plain CONFIG OBJECT of raycaster properties, e.g. `{ far: 10, near: 1 }`, applied to
 *   the engine's own `CursorRaycaster`.
 *
 * Static per engine: it configures the engine's own raycaster once, at install — the one at
 * the BOTTOM of the raycaster stack. At runtime, `useRaycaster()` reaches the stack: mutate
 * the raycaster it hands back, or push a different one over it for a subtree.
 */
export type RaycasterOption = ScreenRaycaster | Partial<BaseProps<Raycaster>>

/**
 * One engine state per `Context`. The registry lives HERE, not in core — which is
 * what makes co-existing engines partition by object provenance: an object only ever
 * enters the registry of the engine whose plugin contributed its handler prop.
 */
export class PointerEventsEngine implements PointerEngine {
  readonly context: Context
  readonly registry: Object3D[] = []
  /**
   * The engine's own raycaster — the one built from the `raycaster` option (or the default
   * `CursorRaycaster`). It sits at the BOTTOM of the stack: it picks whenever no subtree has
   * pushed an override.
   */
  readonly baseRaycaster: ScreenRaycaster
  /**
   * The raycaster overrides, innermost last. A subtree pushes with {@link setRaycaster} and
   * pops on unmount, so the previous raycaster is restored. Reading it (through
   * {@link raycaster}) is reactive: the stack is signal-backed.
   */
  private raycasterStack = new Stack<ScreenRaycaster>("raycaster")
  /**
   * The `raycaster` OPTION this engine was installed with (an instance, a config object,
   * or nothing) — kept so `warnOnIgnoredRaycaster` can tell the instance that actually
   * installed apart from a later one whose option goes nowhere.
   */
  readonly raycasterOption: RaycasterOption | undefined
  private refCounts = new Map<Object3D, number>()
  private manager: DOMPointerManager

  /** The canvas-level miss handler, set through the engine's contributed canvas prop. */
  onPointerMissed: ((event: DispatchEvent) => void) | undefined

  constructor(context: Context, raycaster: ScreenRaycaster, raycasterOption?: RaycasterOption) {
    this.context = context
    this.baseRaycaster = raycaster
    this.raycasterOption = raycasterOption
    // The manager (and through it every `Pointer`) gets an ACCESSOR, never a captured
    // reference: aiming and casting both resolve the top of the stack at the moment of the
    // event, so pushing a raycaster genuinely changes what gets hit.
    this.manager = new DOMPointerManager(context, () => this.raycaster, captureRegistry, this)
  }

  /**
   * The raycaster this canvas picks with right now: the top of the stack, or the engine's
   * own when nothing is pushed. Every aim and every cast goes through here.
   *
   * Reactive — reading it in a tracking scope re-runs when a subtree pushes or pops.
   */
  get raycaster(): ScreenRaycaster {
    return this.raycasterStack.peek() ?? this.baseRaycaster
  }

  /**
   * Push `raycaster` on top of the stack: this canvas picks with it until it is popped.
   * Returns a disposer that pops it, restoring whatever was underneath. The push is also
   * tied to the calling owner, so an unmounting subtree restores the previous raycaster on
   * its own.
   */
  setRaycaster(raycaster: ScreenRaycaster): () => void {
    return this.raycasterStack.push(raycaster)
  }

  /** Attach the source's listeners; returns the disconnect. */
  connect() {
    return this.manager.connect()
  }

  /**
   * Enter `object` into the engine's registry — the set the pointers raycast.
   * Refcounted, so an object carrying several handlers is listed exactly once, and
   * only leaves once its last handler goes.
   *
   * @param object - The 3D object to register.
   * @param _type - The handler type (accepted for symmetry with the contributed prop
   *   names; the single registry is not keyed by type).
   */
  register(object: Object3D, _type: EventName) {
    const count = this.refCounts.get(object) ?? 0
    if (count === 0) this.registry.push(object)
    this.refCounts.set(object, count + 1)
    return () => {
      const current = this.refCounts.get(object)
      if (current === undefined) return
      if (current > 1) {
        this.refCounts.set(object, current - 1)
        return
      }
      this.refCounts.delete(object)
      const index = this.registry.indexOf(object)
      if (index !== -1) this.registry.splice(index, 1)
      // Drop any active capture on a gone object so a drag stops dispatching to a
      // detached node. But a *reactive* handler (e.g. `onPointerMove={dragging() ?
      // a : b}`) re-registers in the same tick — cleanup (refcount → 0) then body
      // (→ 1) — which must NOT tear down a live capture mid-drag. Defer, and
      // release only if the object is still gone (a real unmount), not re-added.
      queueMicrotask(() => {
        if (!this.refCounts.has(object)) this.manager.releaseCaptured(object)
      })
    }
  }
}

/**
 * Engine state is per-`Context`, not per-plugin instance: one `pointerEvents()` can be
 * handed to several canvases, and each needs its own registry, pointers and listeners.
 */
const engines = new WeakMap<Context, PointerEventsEngine>()

export function getEngine(context: Context): PointerEventsEngine | undefined {
  return engines.get(context)
}

/**
 * The engine's one-time per-context setup, run by `Context.initializePlugin` under the
 * Canvas's owner — so `onCleanup` here removes the canvas listeners when the Canvas
 * unmounts, not when whichever element installed the engine first goes away.
 *
 * Reachable ONLY through `Context.initializePlugin` — that is what guarantees this runs
 * under the Canvas's owner (via `runWithOwner`) rather than some short-lived per-element
 * render-effect scope. Do not call this from anywhere else.
 */
export function installEngine(context: Context, raycasterOption?: RaycasterOption) {
  if (engines.has(context)) return
  // The engine's own raycaster — the bottom of the stack. An instance IS the ray strategy,
  // so it's used as given; anything else is a config object applied to the engine's own
  // `CursorRaycaster` — the raycaster `useRaycaster()` hands out until something is pushed
  // over it.
  let screenRaycaster: ScreenRaycaster
  if (isScreenRaycaster(raycasterOption)) {
    screenRaycaster = raycasterOption
  } else {
    screenRaycaster = new CursorRaycaster()
    // `useProps` (rather than `Object.assign`) so the config object accepts the same
    // shapes an element's props do — pierced paths like `params-Line-threshold`,
    // array-to-`set` conversion, and so on.
    if (raycasterOption) useProps(screenRaycaster, raycasterOption, context)
  }
  const engine = new PointerEventsEngine(context, screenRaycaster, raycasterOption)
  engines.set(context, engine)
  onCleanup(engine.connect())
}

/**
 * A pure read: tells the caller whether a `pointerEvents()` instance's `raycaster`
 * option is being silently ignored, without installing anything. Only the first
 * instance to install on a given context (through `Context.initializePlugin`'s token
 * dedup) ever actually configures the engine's raycaster — every later instance's
 * `raycaster` option, if it differs, goes nowhere. This is the DEV-only warning for
 * that case; it never mutates `engines`.
 */
export function warnOnIgnoredRaycaster(context: Context, raycasterOption?: RaycasterOption) {
  if (!process.env.DEV) return
  const installed = engines.get(context)
  if (!installed) return
  if (!raycasterOption) return
  // Identity, not equality: the instance that installed passes the very option object it
  // was constructed with, so it never warns about itself — while a second instance
  // carrying its own (even identical-looking) option is genuinely being ignored.
  if (raycasterOption === installed.raycasterOption) return
  console.warn(
    "S3: an engine is already installed on this canvas, so this pointerEvents() " +
      "instance's `raycaster` option is ignored — the first instance to install wins. " +
      "Configure the raycaster on that instance instead.",
  )
}

function isScreenRaycaster(value: unknown): value is ScreenRaycaster {
  return typeof value === "object" && value !== null && "setCursor" in value && "cast" in value
}
