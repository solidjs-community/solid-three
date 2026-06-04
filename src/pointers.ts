import type { Intersection, Object3D } from "three"
import type { Context, Meta, Prettify, ThreeEvent } from "./types.ts"
import { getMeta } from "./utils.ts"

/**
 * The slice of an `EventRaycaster` a `Pointer` needs: cast its current ray against
 * a registry, and (for the click-missed phase) re-cast a single object. The real
 * `EventRaycaster` (which extends three's `Raycaster`) satisfies this structurally.
 */
export type PointerRaycaster = {
  cast(registry: Object3D[], context: Context): Intersection<Meta<Object3D>>[]
  intersectObject(object: Object3D, recursive?: boolean): Intersection[]
}

/** Creates a `ThreeEvent` (intersection excluded) from a native `MouseEvent` | `PointerEvent` | `WheelEvent`. */
export function createThreeEvent<
  TEvent extends Event,
  TConfig extends { stoppable?: boolean; intersections?: Array<Intersection> },
>(nativeEvent: TEvent, { stoppable = true, intersections }: TConfig = {} as TConfig) {
  const event: Record<string, any> = stoppable
    ? {
        nativeEvent,
        stopped: false,
        stopPropagation() {
          event.stopped = true
        },
      }
    : { nativeEvent }

  if (intersections) {
    event.intersections = intersections
    event.intersection = intersections[0]
  }

  return event as Prettify<
    Omit<
      ThreeEvent<
        TEvent,
        {
          stoppable: TConfig["stoppable"] extends false
            ? TConfig["stoppable"] extends true
              ? true
              : false
            : true
          intersections: TConfig["intersections"] extends Intersection[] ? true : false
        }
      >,
      "currentIntersection"
    >
  >
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

  constructor(
    private context: Context,
    private raycaster: PointerRaycaster,
  ) {}

  /** Hover: enter/leave diff + bubbled `onPointerMove`, plus canvas-level. */
  move(nativeEvent: Event) {
    const intersections = this.raycaster.cast(this.context.eventRegistry, this.context)
    const props = this.context.props as Record<string, any>

    // Phase #1 — Enter (bubble up; fire onPointerEnter for newly-hovered objects).
    const enterEvent: any = createThreeEvent(nativeEvent, { stoppable: false, intersections })
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

    // Phase #2 — Move (bubble up, stoppable).
    const moveEvent: any = createThreeEvent(nativeEvent, { intersections })
    const moved = new Set<Object3D>()
    for (const intersection of intersections) {
      moveEvent.currentIntersection = intersection
      let current: Object3D | null = intersection.object
      while (current && !moved.has(current)) {
        moved.add(current)
        const meta = getMeta(current)
        if (meta) {
          ;(meta.props as any).onPointerMove?.(moveEvent)
          if (moveEvent.stopped) break
        }
        current = current.parent
      }
    }
    if (!moveEvent.stopped) {
      delete moveEvent.currentIntersection
      props.onPointerMove?.(moveEvent)
    }

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
    this.dispatch("onPointerDown", nativeEvent)
  }
  up(nativeEvent: Event) {
    this.dispatch("onPointerUp", nativeEvent)
  }
  wheel(nativeEvent: Event) {
    this.dispatch("onWheel", nativeEvent)
  }

  /**
   * Bubble a "default"-style gesture to an arbitrary handler name (plugin-extensible:
   * the built-in sources fire `onPointerDown`/`onPointerUp`/`onWheel`; a plugin source
   * can fire its own names, e.g. `onXRSelect`). Bubbles up the hit chain honoring
   * `stopPropagation`, then fires canvas-level if unstopped.
   */
  dispatch(handler: string, nativeEvent: Event) {
    const intersections = this.raycaster.cast(this.context.eventRegistry, this.context)
    const event: any = createThreeEvent(nativeEvent, { intersections })
    for (const intersection of intersections) {
      event.currentIntersection = intersection
      let node: Object3D | null = intersection.object
      while (node && !event.stopped) {
        ;(getMeta(node)?.props as any)?.[handler]?.(event)
        node = node.parent
      }
    }
    if (!event.stopped) {
      delete event.currentIntersection
      ;(this.context.props as Record<string, any>)[handler]?.(event)
    }
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
    const event: any = createThreeEvent(nativeEvent, { intersections })

    // Phase #1 — fire the handler, bubbling down the hit chain.
    for (const intersection of intersections) {
      event.currentIntersection = intersection
      let node: Object3D | null = intersection.object
      while (node && !event.stopped && !visited.has(node)) {
        missed.delete(node)
        visited.add(node)
        ;(getMeta(node)?.props as any)?.[kind]?.(event)
        node = node.parent
      }
    }
    if (!event.stopped) {
      delete event.currentIntersection
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
