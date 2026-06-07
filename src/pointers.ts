import { Plane, Vector3, type Intersection, type Object3D, type Ray } from "three"
import type { Context, Meta, PointerCapture, Prettify } from "./types.ts"
import { getMeta } from "./utils.ts"

/**
 * The dispatcher's writable view of an event while it's built and walked. Every
 * field is optional because the object is assembled incrementally: stoppable adds
 * `stopped`/`stopPropagation`; raycasting adds `intersection(s)`/`object`; the tree
 * walk advances `currentObject`/`currentIntersection`; a capturable event gains the
 * `PointerCapture` methods; a plugin source merges typed `TExtra`. Handlers receive
 * the precise public `ThreeEvent` (via their prop types) — this is the internal
 * shape the `Pointer` writes, so the dispatch path needs no `any`.
 */
export type DispatchEvent<TExtra extends object = {}> = {
  nativeEvent: Event
  stopped?: boolean
  stopPropagation?: () => void
  intersections?: Intersection[]
  intersection?: Intersection
  object?: Object3D
  currentObject?: Object3D
  currentIntersection?: Intersection
} & Partial<PointerCapture> &
  TExtra

/**
 * The slice of an `EventRaycaster` a `Pointer` needs: cast its current ray against
 * a registry, (for the click-missed phase) re-cast a single object, and — for
 * pointer capture — `aim` the live `ray` without casting (to reproject onto the
 * captured object's plane). The real `EventRaycaster` (which extends three's
 * `Raycaster`) satisfies this structurally.
 */
export type PointerRaycaster = {
  cast(registry: Object3D[], context: Context): Intersection<Meta<Object3D>>[]
  intersectObject(object: Object3D, recursive?: boolean): Intersection[]
  aim(context: Context): void
  ray: Ray
}

/**
 * Build the {@link DispatchEvent} for one dispatch from a native `MouseEvent` |
 * `PointerEvent` | `WheelEvent`, optionally merging a plugin source's typed `extra`
 * fields (e.g. the XR controller payload). The per-node `currentObject` /
 * `currentIntersection` and the capture methods are added later by the `Pointer`.
 */
export function createThreeEvent<TEvent extends Event, TExtra extends object = {}>(
  nativeEvent: TEvent,
  { stoppable = true, intersections }: { stoppable?: boolean; intersections?: Intersection[] } = {},
  extra?: TExtra,
): Prettify<DispatchEvent<TExtra>> {
  const event: DispatchEvent<TExtra> = (
    stoppable
      ? {
          nativeEvent,
          stopped: false,
          stopPropagation() {
            event.stopped = true
          },
        }
      : { nativeEvent }
  ) as DispatchEvent<TExtra>

  if (intersections) {
    event.intersections = intersections
    event.intersection = intersections[0]
    event.object = intersections[0]?.object
  }

  if (extra) Object.assign(event, extra)

  return event
}

/** The OS-level half of pointer capture, injected per source (DOM canvas vs XR). */
export type PointerCaptureSink = { capture(): void; release(): void }

/**
 * A sink for capture-membership changes, injected by the Solid layer so this
 * framework-agnostic class can feed a reactive `hasPointerCapture(object)` without
 * importing any reactivity. `add` runs on a successful capture, `delete` on
 * release/drop; the implementation refcounts (one object can be captured by more
 * than one pointer).
 */
export interface PointerCaptureRegistry {
  add(object: Object3D): void
  delete(object: Object3D): void
}

/** A held pointer capture. */
interface Captured {
  /**
   * The captured object — the node whose handler called `setPointerCapture`
   * (`event.currentObject`). Captured move/up deliver exclusively to its chain; may be
   * an ancestor of the hit leaf.
   */
  object: Object3D
  /** The drag plane the live ray reprojects onto each move. */
  plane: Plane
  /**
   * The original hit. Its `point` seeds the plane, and its
   * `face`/`uv`/`instanceId`/`object` (the hit leaf) carry through while dragging.
   */
  intersection: Intersection
}

/**
 * One pointer's dispatch + per-pointer state, decoupled from the DOM. A
 * `*PointerManager` owns the source (canvas / XR controller) and the raycaster,
 * and calls these gesture methods; the `Pointer` raycasts the context's single
 * `eventRegistry` and bubbles to the `onPointer*` / `onClick` / … handlers,
 * tracking its own hover state so multiple pointers stay independent.
 *
 * Dispatch logic is ported verbatim from the previous per-kind registries
 * (`createHoverEventRegistry` / `createMissableEventRegistry` /
 * `createDefaultEventRegistry`); the only changes are per-pointer instance state
 * and the single `onPointer*` family (the redundant `onMouse*` family is gone).
 */
export class Pointer {
  private hovered = new Set<Object3D>()
  private hoveredCanvas = false
  private captured: Captured | null = null

  constructor(
    private context: Context,
    private raycaster: PointerRaycaster,
    private sink?: PointerCaptureSink,
    private captureRegistry?: PointerCaptureRegistry,
  ) {}

  /** Whether this pointer currently holds `object` captured. */
  hasCaptured(object: Object3D): boolean {
    return this.captured?.object === object
  }

  /** Whether this pointer currently holds any capture. */
  get capturing(): boolean {
    return this.captured != null
  }

  /**
   * Capture this pointer to `object` (the node whose handler called
   * `setPointerCapture`): build the drag plane through the hit point and engage the
   * OS sink. Subsequent move/up reproject the live ray onto this plane and deliver
   * exclusively to `object`'s chain until released. A nullish `object` (the
   * canvas-level dispatch has no `event.currentObject`) is a no-op.
   *
   * The plane normal is, in order: `normalOverride` (a caller-supplied world-space
   * normal, to constrain the drag — e.g. `+Y` for ground sliding); else the hit
   * face's normal (oriented by `intersection.object`'s world matrix, which differs
   * from `object` when an ancestor captures); else camera-facing.
   */
  capture(
    object: Object3D | null | undefined,
    intersection: Intersection,
    normalOverride?: Vector3,
  ) {
    if (!object) return
    const normal = new Vector3()
    if (normalOverride) {
      normal.copy(normalOverride).normalize()
    } else if (intersection.face) {
      normal.copy(intersection.face.normal).transformDirection(intersection.object.matrixWorld)
    } else {
      this.context.camera.getWorldDirection(normal).negate()
    }
    const plane = new Plane().setFromNormalAndCoplanarPoint(normal, intersection.point)
    this.captured = { object, plane, intersection }
    // Engage the OS sink only after state is set. If it throws — e.g. the pointer
    // isn't in an active-buttons state (a hover move with no button down) — roll
    // back so capture never outlives a failed sink, and swallow the platform error
    // rather than surfacing it into the user's handler.
    try {
      this.sink?.capture()
    } catch {
      this.captured = null
      return
    }
    // Record only a capture that actually took, so the reactive mirror never
    // reports a rolled-back one.
    this.captureRegistry?.add(object)
  }

  /** Release a held capture and notify the OS sink. Idempotent. */
  release() {
    if (!this.captured) return
    this.captureRegistry?.delete(this.captured.object)
    this.captured = null
    this.sink?.release()
  }

  /** Clear capture state only, without notifying the sink (the OS already released). */
  dropCapture() {
    if (!this.captured) return
    this.captureRegistry?.delete(this.captured.object)
    this.captured = null
  }

  /**
   * The forced intersection for a captured pointer: intersect the live ray with
   * the stored plane for a fresh `point`/`distance`, keeping the original hit's
   * `face`/`uv`/`object`. Falls back to the stored hit when there's no forward
   * intersection — the ray is parallel to, or points away from, the plane.
   */
  private reproject(captured: Captured): Intersection {
    this.raycaster.aim(this.context)
    const point = this.raycaster.ray.intersectPlane(captured.plane, new Vector3())
    if (!point) return captured.intersection
    const distance = this.raycaster.ray.origin.distanceTo(point)
    return { ...captured.intersection, point, distance }
  }

  /** Attach the capture methods to a capturable event (down/up/move). */
  private attachCapture(event: DispatchEvent) {
    // With no `object`, captures `event.currentObject` (the firing node) — sync-only,
    // since it's cleared after dispatch (like a DOM event's `currentTarget`). Pass an
    // `object` to capture it later: the caller holds the reference, so it works async.
    event.setPointerCapture = (options?: { object?: Object3D; normal?: Vector3 }) => {
      const object = options?.object ?? event.currentObject
      if (!object) return
      // Sync: the live hit. Async (event already past dispatch, `currentIntersection`
      // gone): synthesize a contact at the object's centre.
      const intersection = event.currentIntersection ?? this.syntheticHit(object)
      this.capture(object, intersection, options?.normal)
    }
    event.releasePointerCapture = () => this.release()
    event.hasPointerCapture = (object?: Object3D) => {
      object ??= event.currentObject
      return object != null && this.hasCaptured(object)
    }
  }

  /**
   * A contact for an explicit/deferred capture with no live ray hit: the object's
   * world-space centre, no face — so {@link capture} builds a camera-facing drag
   * plane through it. Used by `setPointerCapture({ object })` called after dispatch.
   */
  private syntheticHit(object: Object3D): Intersection {
    return { object, point: object.getWorldPosition(new Vector3()), distance: 0 }
  }

  /** Hover: enter/leave diff + bubbled `onPointerMove`, plus canvas-level. */
  move(nativeEvent: Event) {
    // While captured, a move is just a captured `onPointerMove` dispatch:
    // exclusive-but-bubbling delivery to the captured chain (no enter/leave on any
    // object — hover frozen, since `dispatch` never touches `this.hovered`).
    if (this.captured) return this.dispatch("onPointerMove", nativeEvent, undefined, true)

    const intersections = this.raycaster.cast(this.context.eventRegistry, this.context)
    const props = this.context.props as Record<string, any>

    // Phase #1 — Enter (bubble up; fire onPointerEnter for newly-hovered objects).
    const enterEvent = createThreeEvent(nativeEvent, { stoppable: false, intersections })
    const entered = new Set<Object3D>()
    for (const intersection of intersections) {
      enterEvent.currentIntersection = intersection
      let current: Object3D | null = intersection.object
      while (current && !entered.has(current)) {
        entered.add(current)
        if (!this.hovered.has(current)) (getMeta(current)?.props as any)?.onPointerEnter?.(enterEvent)
        current = current.parent
      }
    }
    if (!this.hoveredCanvas) {
      this.hoveredCanvas = true
      props.onPointerEnter?.(enterEvent)
    }

    // Phase #2 — Move (bubble up, stoppable). Capturable: a handler may start a
    // drag by calling `setPointerCapture()` from here.
    const moveEvent = createThreeEvent(nativeEvent, { intersections })
    this.attachCapture(moveEvent)
    this.propagate(
      moveEvent,
      "onPointerMove",
      intersections.map((intersection): [Intersection, Object3D] => [intersection, intersection.object]),
    )

    // Phase #3 — Leave (objects hovered last time but not now).
    const leaveEvent = createThreeEvent(nativeEvent, { stoppable: false, intersections })
    const previous = this.hovered
    this.hovered = entered
    for (const object of previous) {
      if (entered.has(object)) continue
      ;(getMeta(object)?.props as any)?.onPointerLeave?.(leaveEvent)
    }
  }

  /** The pointer left the canvas/source: leave everything currently hovered. */
  leave(nativeEvent: Event) {
    const leaveEvent = createThreeEvent(nativeEvent, { stoppable: false })
    ;(this.context.props as Record<string, any>).onPointerLeave?.(leaveEvent)
    this.hoveredCanvas = false
    for (const object of this.hovered) (getMeta(object)?.props as any)?.onPointerLeave?.(leaveEvent)
    this.hovered.clear()
  }

  down(nativeEvent: Event) {
    this.dispatch("onPointerDown", nativeEvent, undefined, true)
  }
  up(nativeEvent: Event) {
    this.dispatch("onPointerUp", nativeEvent, undefined, true)
  }
  wheel(nativeEvent: Event) {
    this.dispatch("onWheel", nativeEvent)
  }

  /**
   * Propagate `handler` across the roots (nearest-first — raycast propagation) and up
   * each root's parent chain (tree propagation) — setting `event.currentIntersection`
   * for the chain and `event.currentObject` for each node it fires on — honoring
   * `stopPropagation`, then fire the canvas-level handler if nothing stopped it. Each
   * `[intersection, root]` pairs the starting node (`root`) with the intersection to
   * expose while walking it: the captured path passes a single pair rooted at the
   * captured object, the normal path one pair per hit. A node shared by several hits
   * fires once (the closest hit's chain reaches it first), matching `move`/`click`.
   */
  private propagate(event: DispatchEvent, handler: string, roots: Array<[Intersection, Object3D]>) {
    const visited = new Set<Object3D>()
    for (const [intersection, root] of roots) {
      event.currentIntersection = intersection
      let node: Object3D | null = root
      while (node && !event.stopped && !visited.has(node)) {
        visited.add(node)
        event.currentObject = node
        ;(getMeta(node)?.props as any)?.[handler]?.(event)
        node = node.parent
      }
      if (event.stopped) break
    }
    if (!event.stopped) {
      delete event.currentIntersection
      event.currentObject = undefined
      ;(this.context.props as Record<string, any>)[handler]?.(event)
    }
  }

  /**
   * Dispatch a "default"-style gesture to an arbitrary handler name (plugin-extensible:
   * the built-in sources fire `onPointerDown`/`onPointerUp`/`onWheel`; a plugin source
   * can fire its own names, e.g. `onXRSelect`). Propagates along the hit chain honoring
   * `stopPropagation`, then fires canvas-level if unstopped. `extra` is merged onto the
   * event (plugin sources use it for rich fields, e.g. the XR controller payload), and
   * `event.currentObject` exposes the node a handler is firing on. When this pointer
   * holds a capture, delivery is exclusive to the captured object's chain (the
   * registry is not raycast) but still bubbles to the canvas-level handler; the
   * intersection is the live ray reprojected onto the captured plane.
   */
  dispatch<TExtra extends object = {}>(
    handler: string,
    nativeEvent: Event,
    extra?: TExtra,
    capturable = false,
  ) {
    const captured = this.captured
    if (captured) {
      // Captured: exclusive delivery to the captured object's chain, with the live
      // ray reprojected onto the captured plane.
      const intersection = this.reproject(captured)
      const event = createThreeEvent(nativeEvent, { intersections: [intersection] }, extra)
      if (capturable) this.attachCapture(event)
      this.propagate(event, handler, [[intersection, captured.object]])
      return
    }

    const intersections = this.raycaster.cast(this.context.eventRegistry, this.context)
    const event = createThreeEvent(nativeEvent, { intersections }, extra)
    if (capturable) this.attachCapture(event)
    this.propagate(
      event,
      handler,
      intersections.map((intersection): [Intersection, Object3D] => [intersection, intersection.object]),
    )
  }

  /** Missable gesture: bubbled `onClick`/`onDoubleClick`/`onContextMenu` + `-Missed`. */
  click(kind: "onClick" | "onDoubleClick" | "onContextMenu", nativeEvent: Event) {
    const missedType = `${kind}Missed` as const
    const registry = this.context.eventRegistry
    const props = this.context.props as Record<string, any>
    if (registry.length === 0 && !props[kind] && !props[missedType]) return

    const missed = new Set<Object3D>(registry)
    const visited = new Set<Object3D>()
    const intersections = this.raycaster.cast(registry, this.context)
    const event = createThreeEvent(nativeEvent, { intersections })

    // Phase #1 — fire the handler, bubbling down the hit chain.
    for (const intersection of intersections) {
      event.currentIntersection = intersection
      let node: Object3D | null = intersection.object
      while (node && !event.stopped && !visited.has(node)) {
        missed.delete(node)
        visited.add(node)
        event.currentObject = node
        ;(getMeta(node)?.props as any)?.[kind]?.(event)
        node = node.parent
      }
    }
    if (!event.stopped) {
      delete event.currentIntersection
      event.currentObject = undefined
      props[kind]?.(event)
    }

    // Phase #2 — re-raycast remaining objects to mark any genuinely under the ray as hit.
    for (const remaining of missed) {
      const hits = this.raycaster.intersectObject(remaining, true)
      for (const { object } of hits) {
        let node: Object3D | null = object
        while (node && !visited.has(node)) {
          missed.delete(node)
          visited.add(node)
          node = node.parent
        }
      }
    }

    // Phase #3 — fire `-Missed` on the truly-missed objects, and canvas-level on a total miss.
    const missedEvent = createThreeEvent(nativeEvent, { stoppable: false })
    for (const object of missed) (getMeta(object)?.props as any)?.[missedType]?.(missedEvent)
    if (intersections.length === 0) props[missedType]?.(missedEvent)
  }
}
