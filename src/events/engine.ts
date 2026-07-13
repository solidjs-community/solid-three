import { onCleanup } from "solid-js"
import type { Object3D } from "three"
import type { Context } from "../types.ts"
import { captureRegistry } from "./pointer-capture.ts"
import { DOMPointerManager } from "./pointer-managers.ts"
import type { DispatchEvent, PointerEngine } from "./pointers.ts"
import { CursorRaycaster, type ScreenRaycaster } from "./raycasters.ts"
import type { EventName } from "./types.ts"

/**
 * One engine state per `Context`. The registry lives HERE, not in core — which is
 * what makes co-existing engines partition by object provenance: an object only ever
 * enters the registry of the engine whose plugin contributed its handler prop.
 */
export class PointerEventsEngine implements PointerEngine {
  readonly context: Context
  readonly registry: Object3D[] = []
  /**
   * The screen raycaster this engine was installed with — exposed so
   * `warnOnIgnoredRaycaster` can tell whether a later `pointerEvents()` instance's
   * `raycaster` option differs from the one actually in effect.
   */
  readonly raycaster: ScreenRaycaster
  private refCounts = new Map<Object3D, number>()
  private manager: DOMPointerManager

  /** The canvas-level miss handler, set through the engine's contributed canvas prop. */
  onPointerMissed: ((event: DispatchEvent) => void) | undefined

  constructor(context: Context, raycaster: ScreenRaycaster) {
    this.context = context
    this.raycaster = raycaster
    this.manager = new DOMPointerManager(context, raycaster, captureRegistry, this)
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
export function installEngine(context: Context, raycaster?: ScreenRaycaster) {
  if (engines.has(context)) return
  // The screen pointer's ray strategy: the engine's configured raycaster, else the
  // canvas's own when that is a screen raycaster, else a fresh `CursorRaycaster`.
  const candidate: unknown = raycaster ?? context.raycaster
  const screenRaycaster: ScreenRaycaster = isScreenRaycaster(candidate)
    ? candidate
    : new CursorRaycaster()
  const engine = new PointerEventsEngine(context, screenRaycaster)
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
export function warnOnIgnoredRaycaster(context: Context, raycaster?: ScreenRaycaster) {
  if (!process.env.DEV) return
  const installed = engines.get(context)
  if (!installed) return
  if (!raycaster) return
  if (raycaster === installed.raycaster) return
  console.warn(
    "S3: an engine is already installed on this canvas, so this pointerEvents() " +
      "instance's `raycaster` option is ignored — the first instance to install wins. " +
      "Configure the raycaster on that instance instead.",
  )
}

function isScreenRaycaster(value: unknown): value is ScreenRaycaster {
  return typeof value === "object" && value !== null && "setCursor" in value && "cast" in value
}
