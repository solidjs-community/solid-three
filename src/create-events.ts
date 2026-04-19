import { Object3D, type Intersection } from "three"
import { SHOULD_DEBUG } from "./constants.ts"
import type { Context, EventName, Meta, Prettify, ThreeEvent } from "./types.ts"
import { createDebug, getMeta } from "./utils.ts"

const debugEvents = createDebug("events:raycast", SHOULD_DEBUG)
const debugMissable = createDebug("events:missable", SHOULD_DEBUG)
const debugHover = createDebug("events:hover", SHOULD_DEBUG)
const debugDefault = createDebug("events:default", SHOULD_DEBUG)
const debugRegistry = createDebug("events:registry", SHOULD_DEBUG)

const eventNameMap = {
  onClick: "click",
  onContextMenu: "contextmenu",
  onDoubleClick: "dblclick",
  onMouseDown: "mousedown",
  onMouseMove: "mousemove",
  onMouseUp: "mouseup",
  onMouseLeave: "mouseleave",
  onPointerUp: "pointerup",
  onPointerDown: "pointerdown",
  onPointerMove: "pointermove",
  onPointerLeave: "pointerleave",
  onWheel: "wheel",
} as const

function createRegistry<T>() {
  const array: T[] = []

  return {
    array,
    add(instance: T) {
      array.push(instance)
      return () => {
        array.splice(
          array.findIndex(_instance => _instance === instance),
          1,
        )
      }
    },
  }
}

/**********************************************************************************/
/*                                                                                */
/*                                   Is Event Type                                */
/*                                                                                */
/**********************************************************************************/

/**
 * Checks if a given string is a valid event type within the system.
 *
 * @param type - The type of the event to check.
 * @returns `true` if the type is a recognized `EventType`, otherwise `false`.
 */
export const isEventType = (type: string): type is EventName =>
  /^on(Pointer|Click|DoubleClick|ContextMenu|Wheel|Mouse)/.test(type)

/**********************************************************************************/
/*                                                                                */
/*                                      Events                                    */
/*                                                                                */
/**********************************************************************************/
//
/** Creates a `ThreeEvent` (intersection excluded) from the current `MouseEvent` | `WheelEvent`. */
function createThreeEvent<
  TEvent extends Event,
  TConfig extends { stoppable?: boolean; intersections?: Array<Intersection> },
>(nativeEvent: TEvent, { stoppable = true, intersections }: TConfig = {} as TConfig) {
  debugEvents("create", { stoppable, hasIntersections: !!intersections })
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

/**********************************************************************************/
/*                                                                                */
/*                                     Raycast                                    */
/*                                                                                */
/**********************************************************************************/

/**
 * Performs a raycast from the camera through the mouse position to find intersecting 3D objects.
 */
function raycast<TNativeEvent extends MouseEvent | WheelEvent>(
  context: Context,
  registry: Object3D[],
  event: TNativeEvent,
): Intersection<Meta<Object3D>>[] {
  if ("update" in context.raycaster) {
    debugEvents("update", { variant: "custom" })
    context.raycaster.update(event, context)
  } else {
    debugEvents("update", { variant: "skip", reason: "no update method" })
  }

  const nodeSet = new Set<Object3D>()
  const visitedSet = new Set<Object3D>()
  const stack = [...registry]
  let skippedCount = 0
  let raycastableCount = 0

  // Collect all unique descendants of registry
  for (const object of stack) {
    if (visitedSet.has(object)) {
      skippedCount++
      continue
    }
    visitedSet.add(object)

    const meta = getMeta(object)
    if (meta && meta.props.raycastable !== false) {
      nodeSet.add(object)
      raycastableCount++
    }

    stack.push(...object.children)
  }

  debugEvents("traverse", {
    processed: visitedSet.size,
    raycastable: raycastableCount,
    skipped: skippedCount,
  })

  const results = context.raycaster.intersectObjects(nodeSet.values().toArray(), false)
  debugEvents("intersected", {
    registry: registry.length,
    nodes: nodeSet.size,
    intersections: results.length,
  })
  // nodeSet only contains objects that already have $S3C metadata (see the
  // traversal above — `meta && meta.props.raycastable !== false`), so every
  // intersected object is Meta<Object3D>. Three.js's Intersection type doesn't
  // know this, hence the cast.
  return results as Intersection<Meta<Object3D>>[]
}

/**********************************************************************************/
/*                                                                                */
/*                           Create Missable Event Registry                       */
/*                                                                                */
/**********************************************************************************/

/**
 * A registry for `MissableEvents`:
 * - `onClick` / `onClickMissed`
 * - `onContextMenu` / `onContextMenuMissed`
 * - `onDoubleClick` / `onDoubleClickMissed`
 */
function createMissableEventRegistry(
  type: "onClick" | "onDoubleClick" | "onContextMenu",
  context: Context,
) {
  const registry = createRegistry<Object3D>()

  context.canvas.addEventListener(eventNameMap[type], nativeEvent => {
    if (registry.array.length === 0) {
      debugMissable("skipped", { type, reason: "empty registry" })
      return
    }
    debugMissable("fired", { type, registrySize: registry.array.length })

    const missedType = `${type}Missed` as const

    // Track which objects have been visited during event processing
    const missedObjects = new Set(registry.array)
    const visitedObjects = new Set()

    // Phase #1 - Process normal click events
    const intersections = raycast(context, registry.array, nativeEvent)
    debugMissable("phase1", { type, intersections: intersections.length })

    const stoppableEvent = createThreeEvent(nativeEvent, { intersections })

    let processedIntersections = 0
    for (const intersection of intersections) {
      // Update currentIntersection
      // @ts-expect-error TODO: fix type-error
      stoppableEvent.currentIntersection = intersection
      processedIntersections++

      // Bubble down
      let node: Object3D | null = intersection.object
      let bubbledCount = 0
      while (node && !stoppableEvent.stopped && !visitedObjects.has(node)) {
        bubbledCount++
        missedObjects.delete(node)
        visitedObjects.add(node)
        getMeta(node)?.props[type]?.(
          // @ts-expect-error TODO: fix type-error
          stoppableEvent,
        )
        node = node.parent
      }
      if (stoppableEvent.stopped) {
        debugMissable("bubble-stopped", { type, bubbledLevels: bubbledCount })
      } else {
        debugMissable("bubble-completed", { type, bubbledLevels: bubbledCount })
      }
    }
    debugMissable("intersections-processed", { type, count: processedIntersections })

    // Call the respective canvas event-handler
    // if event propagated all the way down
    if (!stoppableEvent.stopped) {
      debugMissable("propagated", { type })
      // Remove currentIntersection
      // @ts-expect-error TODO: fix type-error
      delete stoppableEvent.currentIntersection
      context.props[type]?.(stoppableEvent)
    } else {
      debugMissable("stopped", { type })
    }

    // Phase #2 - Raycast remaining missed objects
    let phase2ProcessedCount = 0
    for (const remainingObject of missedObjects) {
      const intersections = context.raycaster.intersectObject(remainingObject, true)
      phase2ProcessedCount++

      // Bubble down intersections
      // if they haven't been visited before:
      // - add object to visitedObjects
      // - remove from remainingObjects,
      if (intersections.length === 0) {
        debugMissable("phase2-no-intersections", { type })
      }

      let phase2IntersectionCount = 0
      for (const { object } of intersections) {
        phase2IntersectionCount++
        let node: Object3D | null = object
        while (node && !visitedObjects.has(node)) {
          missedObjects.delete(node)
          visitedObjects.add(node)
          node = node.parent
        }
      }
    }
    debugMissable("phase2", { type, processedObjects: phase2ProcessedCount })

    // Phase #3 - Fire missed event-handler on missed objects
    const missedEvent = createThreeEvent(nativeEvent, { stoppable: false })
    debugMissable("phase3", { type, missedCount: missedObjects.size })

    for (const object of missedObjects) {
      getMeta(object)?.props[missedType]?.(missedEvent)
    }

    if (visitedObjects.size > 0) {
      debugMissable("missed-fired", { type, missedType, visitedCount: visitedObjects.size })
    } else {
      debugMissable("missed-none", { type, reason: "no objects visited" })
    }
  })

  return registry
}

/**********************************************************************************/
/*                                                                                */
/*                            Create Hover Event Registry                         */
/*                                                                                */
/**********************************************************************************/

/**
 * A registry for `HoverEvents`:
 * - Mouse
 *    - `onMouseEnter`
 *    - `onMouseMove`
 *    - `onMouseLeave`
 * - Pointer
 *    - `onPointerEnter`
 *    - `onPointerMove`
 *    - `onPointerLeave`
 */
function createHoverEventRegistry(type: "Mouse" | "Pointer", context: Context) {
  const registry = createRegistry<Object3D>()
  let hoveredSet = new Set<Object3D>()
  let intersections: Intersection<Meta<Object3D>>[] = []
  let hoveredCanvas = false
  debugHover("init", { type })

  context.canvas.addEventListener(eventNameMap[`on${type}Move`], nativeEvent => {
    intersections = raycast(context, registry.array, nativeEvent)
    debugHover("move", {
      type,
      intersections: intersections.length,
      registrySize: registry.array.length,
    })

    // Phase #1 - Enter
    const enterEvent = createThreeEvent(nativeEvent, { stoppable: false, intersections })
    const enterSet = new Set<Object3D>()

    let enterCount = 0
    for (const intersection of intersections) {
      // Update currentIntersection
      // @ts-expect-error TODO: fix type-error
      enterEvent.currentIntersection = intersection

      // Bubble up
      let current: Object3D | null = intersection.object
      while (current && !enterSet.has(current)) {
        enterSet.add(current)
        if (!hoveredSet.has(current)) {
          enterCount++

          debugHover("enter", { object: (current as any).type || "unknown" })

          getMeta(current)?.props[`on${type}Enter`]?.(
            // @ts-expect-error TODO: fix type-error
            enterEvent,
          )
        } else {
          debugHover("enter-skipped", {
            object: (current as any).type || "unknown",
            reason: "already hovered",
          })
        }

        // We bubble a layer down.
        current = current.parent
      }
    }

    if (hoveredCanvas === false) {
      debugHover("canvas-enter", { type })

      context.props[`on${type}Enter`]?.(
        // @ts-expect-error TODO: fix type-error
        enterEvent,
      )
      hoveredCanvas = true
    } else {
      debugHover("canvas-already-entered", { type })
    }

    // Phase #2 - Move
    const moveEvent = createThreeEvent(nativeEvent, { intersections })
    const moveSet = new Set()

    let moveCount = 0
    for (const intersection of intersections) {
      // Update currentIntersection
      // @ts-expect-error TODO: fix type-error
      moveEvent.currentIntersection = intersection
      moveCount++

      // Bubble up
      let current: Object3D | null = intersection.object

      while (current && !moveSet.has(current)) {
        moveSet.add(current)
        const meta = getMeta(current)
        if (meta) {
          meta.props[`on${type}Move`]?.(
            // @ts-expect-error TODO: fix type-error
            moveEvent,
          )
          // Break if event was
          if (moveEvent.stopped) {
            debugHover("move-stopped", { type })
            break
          }
        } else {
          debugHover("move-no-meta", { type })
        }
        // We bubble a layer down.
        current = current.parent
      }
    }
    debugHover("enter-processed", { type, newEnters: enterCount })
    debugHover("move-processed", { type, count: moveCount })

    if (!moveEvent.stopped) {
      debugHover("move-propagated", { type })
      // Remove currentIntersection
      // @ts-expect-error TODO: fix type-error
      delete moveEvent.currentIntersection
      context.props[`on${type}Move`]?.(
        // @ts-expect-error TODO: fix type-error
        moveEvent,
      )
    } else {
      debugHover("move-not-propagated", { type })
    }

    // Handle leave-event
    const leaveEvent = createThreeEvent(nativeEvent, { intersections, stoppable: false })
    const leaveSet = hoveredSet.difference(enterSet)
    hoveredSet = enterSet
    debugHover("leave-count", { type, leaveCount: leaveSet.size })

    for (const object of leaveSet.values()) {
      debugHover("leave", { object: (object as any).type || "unknown" })
      getMeta(object)?.props[`on${type}Leave`]?.(
        // @ts-expect-error TODO: fix type-error
        leaveEvent,
      )
    }
  })

  context.canvas.addEventListener(eventNameMap[`on${type}Leave`], nativeEvent => {
    debugHover("leave-exit", { type, hoveredSize: hoveredSet.size })
    const leaveEvent = createThreeEvent(nativeEvent, { stoppable: false })
    // @ts-expect-error TODO: fix type-error
    context.props[`on${type}Leave`]?.(leaveEvent)
    hoveredCanvas = false

    let canvasLeaveCount = 0
    for (const object of hoveredSet) {
      canvasLeaveCount++
      getMeta(object)?.props[`on${type}Leave`]?.(
        // @ts-expect-error TODO: fix type-error
        leaveEvent,
      )
    }
    debugHover("leave-exit-processed", { type, count: canvasLeaveCount })
    hoveredSet.clear()
  })

  return registry
}

/**********************************************************************************/
/*                                                                                */
/*                            Create Default Event Registry                       */
/*                                                                                */
/**********************************************************************************/

/**
 * A registry for `DefaultEvents`:
 * - `onMouseDown`
 * - `onMouseUp`
 * - `onPointerDown`
 * - `onPointerUp`
 * - `onWheel`
 */
function createDefaultEventRegistry(
  type: "onMouseDown" | "onMouseUp" | "onPointerDown" | "onPointerUp" | "onWheel",
  context: Context,
  options?: AddEventListenerOptions,
) {
  const registry = createRegistry<Object3D>()
  debugDefault("init", { type })

  context.canvas.addEventListener(
    eventNameMap[type],
    nativeEvent => {
      const intersections = raycast(context, registry.array, nativeEvent)
      debugDefault("fired", {
        type,
        intersections: intersections.length,
        registrySize: registry.array.length,
      })
      const event = createThreeEvent(nativeEvent, { intersections })

      let processedCount = 0
      for (const intersection of intersections) {
        processedCount++
        // Update currentIntersection
        // @ts-expect-error TODO: fix type-error
        event.currentIntersection = intersection

        // Bubble up
        let node: Object3D | null = intersection.object
        let bubbledCount = 0

        while (node && !event.stopped) {
          bubbledCount++
          getMeta(node)?.props[type]?.(
            // @ts-expect-error TODO: fix type-error
            event,
          )
          node = node.parent
        }
        
        if (event.stopped) {
          debugDefault("bubble-stopped", { type, bubbledLevels: bubbledCount })
        } else {
          debugDefault("bubble-completed", { type, bubbledLevels: bubbledCount })
        }
      }
      debugDefault("intersections-processed", { type, count: processedCount })

      if (!event.stopped) {
        debugDefault("propagated", { type })
        // Remove currentIntersection
        // @ts-expect-error TODO: fix type-error
        delete event.currentIntersection

        // @ts-expect-error TODO: fix type-error
        context.props[type]?.(event)
      } else {
        debugDefault("stopped", { type })
      }
    },
    options,
  )

  return registry
}

/**********************************************************************************/
/*                                                                                */
/*                                  Create Events                                 */
/*                                                                                */
/**********************************************************************************/

/**
 * Initializes and manages event handling for all `Instance<Object3D>`.
 */
export function createEvents(context: Context) {
  // onMouseMove/onMouseEnter/onMouseLeave
  const hoverMouseRegistry = createHoverEventRegistry("Mouse", context)
  // onPointerMove/onPointerEnter/onPointerLeave
  const hoverPointerRegistry = createHoverEventRegistry("Pointer", context)

  // onClick/onClickMissed
  const missableClickRegistry = createMissableEventRegistry("onClick", context)
  // onContextMenu/onContextMenuMissed
  const missableContextMenuRegistry = createMissableEventRegistry("onContextMenu", context)
  // onDoubleClick/onDoubleClickMissed
  const missableDoubleClickRegistry = createMissableEventRegistry("onDoubleClick", context)

  // Default mouse-events
  const mouseDownRegistry = createDefaultEventRegistry("onMouseDown", context)
  const mouseUpRegistry = createDefaultEventRegistry("onMouseUp", context)
  // Default pointer-events
  const pointerDownRegistry = createDefaultEventRegistry("onPointerDown", context)
  const pointerUpRegistry = createDefaultEventRegistry("onPointerUp", context)
  // Default wheel-event
  const wheelRegistry = createDefaultEventRegistry("onWheel", context, { passive: true })

  return {
    /**
     * Registers an `AugmentedElement<Object3D>` with the event handling system.
     *
     * @param object - The 3D object to register.
     * @param type - The type of event the object should listen for.
     */
    addEventListener(object: Meta<Object3D>, type: EventName) {
      switch (type) {
        // Missable Events
        case "onClick":
        case "onClickMissed":
          debugRegistry("bound", { event: type, category: "missable" })
          return missableClickRegistry.add(object)
        case "onContextMenu":
        case "onContextMenuMissed":
          debugRegistry("bound", { event: type, category: "missable" })
          return missableContextMenuRegistry.add(object)
        case "onDoubleClick":
        case "onDoubleClickMissed":
          debugRegistry("bound", { event: type, category: "missable" })
          return missableDoubleClickRegistry.add(object)

        // Hover Events
        case "onMouseEnter":
        case "onMouseLeave":
        case "onMouseMove":
          debugRegistry("bound", { event: type, category: "hover" })
          return hoverMouseRegistry.add(object)
        case "onPointerEnter":
        case "onPointerLeave":
        case "onPointerMove":
          debugRegistry("bound", { event: type, category: "hover" })
          return hoverPointerRegistry.add(object)

        // Default Events
        case "onMouseDown":
        case "onMouseUp":
        case "onPointerDown":
        case "onPointerUp":
        case "onWheel":
          debugRegistry("bound", { event: type, category: "default" })
          switch (type) {
            case "onMouseDown":
              return mouseDownRegistry.add(object)
            case "onMouseUp":
              return mouseUpRegistry.add(object)
            case "onPointerDown":
              return pointerDownRegistry.add(object)
            case "onPointerUp":
              return pointerUpRegistry.add(object)
            case "onWheel":
              return wheelRegistry.add(object)
          }
      }
    },
  }
}
