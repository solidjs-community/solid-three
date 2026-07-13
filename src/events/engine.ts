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
   * The screen raycaster this engine was installed with — exposed so a later,
   * skipped `installEngine` call can tell whether its own `raycaster` option
   * differs from the one actually in effect (see `installEngine`).
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
 */
export function installEngine(context: Context, raycaster?: ScreenRaycaster) {
  const installed = engines.get(context)
  if (installed) {
    // A second `pointerEvents()` instance's `install` is never actually called here —
    // `initializePlugin`'s token dedup (the engine's token is shared across every
    // instance, by design — see `POINTER_EVENTS_TOKEN`) skips it before `installEngine`
    // is reached. `pointerEvents()`'s `canvas` contribution calls `installEngine` again
    // as a workaround: canvas-prop resolution runs unconditionally per plugin instance,
    // so it's what actually gets a second instance's `raycaster` option this far. This
    // guard is the source of truth for "one engine per context" either way, and this is
    // the one place a differing `raycaster` option going nowhere becomes observable.
    if (process.env.DEV && raycaster && raycaster !== installed.raycaster) {
      console.warn(
        "S3: a second pointerEvents() instance was installed on a context that already " +
          "has an engine — its `raycaster` option is ignored; only the first instance's " +
          "`raycaster` takes effect. Configure the raycaster on that one instead.",
      )
    }
    return
  }
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

function isScreenRaycaster(value: unknown): value is ScreenRaycaster {
  return typeof value === "object" && value !== null && "setCursor" in value && "cast" in value
}
