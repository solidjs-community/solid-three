import { type Intersection, Object3D } from "three"
import { $S3C } from "./augment.ts"
import { S3 } from "./index.ts"
import { isInstance } from "./utils/is-instance.ts"

const eventNameMap = {
  onClick: "click",
  onContextMenu: "contextmenu",
  onDoubleClick: "dblclick",
  onMouseDown: "mousedown",
  onMouseMove: "mousemove",
  onMouseUp: "mouseup",
  onPointerUp: "pointerup",
  onPointerDown: "pointerdown",
  onPointerMove: "pointermove",
  onWheel: "wheel",
} as const

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
export const isEventType = (type: string): type is S3.EventName =>
  /^on(Pointer|Click|DoubleClick|ContextMenu|Wheel|Mouse)/.test(type)

/**********************************************************************************/
/*                                                                                */
/*                                   Bubble Down                                  */
/*                                                                                */
/**********************************************************************************/

/**
 * Propagates an event down through the ancestors of a given `Object3D` in a scene graph,
 * calling the event handler for each ancestor as long as the event has not been marked as stopped.
 */
function bubbleDown(
  element: S3.Instance<Object3D>,
  type: S3.EventName,
  event: S3.Event<MouseEvent | WheelEvent>,
) {
  let node: Object3D | null = element.parent
  while (node) {
    // If event has been stopped with event.stopPropagation() we break out.
    if (event.stopped) break
    // If node is an AugmentedElement we call the type's event-handler if it is defined.
    if (isInstance(node)) {
      // @ts-expect-error TODO: fix type-error
      node[$S3C].props[type]?.(event)
    }
    // We bubble a layer down.
    node = node.parent
  }
}

/**********************************************************************************/
/*                                                                                */
/*                                Create Three Event                              */
/*                                                                                */
/**********************************************************************************/

// Creates a `ThreeEvent` from the current `MouseEvent` | `WheelEvent`.
function createThreeEvent<TEvent extends Event>(nativeEvent: TEvent): S3.Event<TEvent> {
  const event = {
    ...nativeEvent,
    nativeEvent,
    stopped: false,
    stopPropagation() {
      event.stopped = true
    },
  }
  return event
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
  context: S3.Context,
  registry: Object3D[],
  nativeEvent: TNativeEvent,
): Intersection<S3.Instance<Object3D>>[] {
  context.setPointer(pointer => {
    pointer.x = (nativeEvent.offsetX / globalThis.innerWidth) * 2 - 1
    pointer.y = -(nativeEvent.offsetY / globalThis.innerHeight) * 2 + 1
    return pointer
  })
  context.raycaster.setFromCamera(context.pointer, context.camera)

  const nodeSet = new Set<Object3D>()
  const stack = [...registry]

  // Collect all unique descendants of registry
  for (const object of stack) {
    if (nodeSet.has(object)) continue
    nodeSet.add(object)
    stack.push(...object.children)
  }

  return context.raycaster.intersectObjects(nodeSet.values().toArray(), false)
}

/**********************************************************************************/
/*                                                                                */
/*                           Create Missable Event Registry                       */
/*                                                                                */
/**********************************************************************************/

/**
 * A registry for `on{Click|DoubleClick|ContextMenu}`-
 * and their respective `on{Click|DoubleClick|ContextMenu}Missed`-event
 */
function createMissableEventRegistry(
  context: S3.Context,
  type: "onClick" | "onDoubleClick" | "onContextMenu",
) {
  const registry: Object3D[] = []

  context.canvas.addEventListener(eventNameMap[type], nativeEvent => {
    if (registry.length === 0) return
    const event = createThreeEvent(nativeEvent)
    const missedType = `${type}Missed` as const

    // Track which objects have been visited during event processing
    const missedObjects = new Set(registry)
    const visitedObjects = new Set()

    // Phase #1 - Process normal click events
    const intersections = raycast(context, registry, nativeEvent)

    for (const { object } of intersections) {
      let node: Object3D | null = object
      while (node && !event.stopped && !visitedObjects.has(node)) {
        missedObjects.delete(node)
        visitedObjects.add(node)
        if (isInstance(node)) {
          node[$S3C].props?.[type]?.(event)
        }
        node = node.parent
      }
    }

    // Phase #2 - Raycast remaining missed objects
    for (const remainingObject of missedObjects) {
      // Perform raycast on unvisited missed objects
      context.raycaster.setFromCamera(context.pointer, context.camera)
      const intersections = context.raycaster.intersectObject(remainingObject, true)

      // Bubble down intersections
      // if they haven't been visited before:
      // - add object to visitedObjects
      // - remove from remainingObjects,
      for (const { object } of intersections) {
        let node: Object3D | null = object
        while (node && !visitedObjects.has(node)) {
          missedObjects.delete(node)
          visitedObjects.add(node)
          node = node.parent
        }
      }
    }

    // Phase #3 - Fire missed event-handler on missed objects
    for (const object of missedObjects) {
      if (isInstance(object)) {
        object[$S3C].props?.[missedType]?.(nativeEvent)
      }
    }
  })

  return (instance: S3.Instance<Object3D>) => {
    registry.push(instance)
    return () => {
      registry.splice(
        registry.findIndex(_instance => _instance === instance),
        1,
      )
    }
  }
}

/**********************************************************************************/
/*                                                                                */
/*                            Create Hover Event Registry                         */
/*                                                                                */
/**********************************************************************************/

/**
 * A registry for `on{Pointer|Mouse}Move` events.
 * This handler manages also its derived events:
 * - `on{Pointer|Mouse}Enter`
 * - `on{Pointer|Mouse}Leave`
 */
function createHoverEventRegistry(context: S3.Context, type: "Mouse" | "Pointer") {
  const registry: S3.Instance<Object3D>[] = []
  const priorMoveIntersects = new Set<S3.Instance<Object3D>>()
  let priorMoveEvent: undefined | MouseEvent = undefined

  context.canvas.addEventListener(eventNameMap[`on${type}Move`], nativeEvent => {
    const moveEvent = createThreeEvent(nativeEvent)
    const enterEvent = createThreeEvent(nativeEvent)
    const staleIntersects = new Set(priorMoveIntersects)

    for (const intersection of raycast(context, registry, nativeEvent)) {
      const props = intersection.object[$S3C].props

      // Handle enter-event
      if (!enterEvent.stopped && !priorMoveIntersects.has(intersection.object)) {
        // @ts-expect-error TODO: fix type-error
        props[`on${type}Enter`]?.(enterEvent)
        bubbleDown(intersection.object, `on${type}Enter`, enterEvent)
      }

      // Handle move-event
      if (!moveEvent.stopped) {
        // @ts-expect-error TODO: fix type-error
        props[`on${type}Move`]?.(moveEvent)
        bubbleDown(intersection.object, `on${type}Move`, moveEvent)
      }

      staleIntersects.delete(intersection.object)
      priorMoveIntersects.add(intersection.object)

      if (moveEvent.stopped && enterEvent.stopped) break
    }

    // Handle leave-event
    if (priorMoveEvent) {
      const leaveEvent = createThreeEvent(priorMoveEvent)

      for (const object of staleIntersects.values()) {
        priorMoveIntersects.delete(object)

        if (!leaveEvent.stopped) {
          const props = object[$S3C].props
          // @ts-expect-error TODO: fix type-error
          props[`on${type}Leave`]?.(leaveEvent)
          bubbleDown(object, `on${type}Leave`, leaveEvent)
        }
      }
    }

    priorMoveEvent = nativeEvent
  })

  return (instance: S3.Instance<Object3D>) => {
    registry.push(instance)
    return () => {
      registry.splice(
        registry.findIndex(_instance => _instance === instance),
        1,
      )
    }
  }
}

/**********************************************************************************/
/*                                                                                */
/*                            Create Default Event Registry                       */
/*                                                                                */
/**********************************************************************************/

function createDefaultEventRegistry(
  context: S3.Context,
  type: "onMouseDown" | "onPointerDown" | "onMouseUp" | "onPointerUp" | "onWheel",
  options?: AddEventListenerOptions,
) {
  const registry: S3.Instance<Object3D>[] = []

  context.canvas.addEventListener(
    eventNameMap[type],
    nativeEvent => {
      const event = createThreeEvent(nativeEvent)
      const intersections = raycast(context, registry, nativeEvent)

      for (const { object } of intersections) {
        object[$S3C].props?.[type]?.(event)
        bubbleDown(object, type, event)
        if (event.stopped) break
      }
    },
    options,
  )

  return (instance: S3.Instance<Object3D>) => {
    registry.push(instance)
    return () =>
      registry.splice(
        registry.findIndex(_instance => _instance === instance),
        1,
      )
  }
}

/**********************************************************************************/
/*                                                                                */
/*                                  Create Events                                 */
/*                                                                                */
/**********************************************************************************/

/**
 * Initializes and manages event handling for all `Instance<Object3D>`.
 */
export function createEvents(context: S3.Context) {
  // onMouseMove/onMouseEnter/onMouseLeave
  const addHoverMouseListener = createHoverEventRegistry(context, "Mouse")
  // onPointerMove/onPointerEnter/onPointerLeave
  const addHoverPointerListener = createHoverEventRegistry(context, "Pointer")

  // onClick/onClickMissed
  const addMissableClickListener = createMissableEventRegistry(context, "onClick")
  // onContextMenu/onContextMenuMissed
  const addMissableContextMenuListener = createMissableEventRegistry(context, "onContextMenu")
  // onDoubleClick/onDoubleClickMissed
  const addMissableDoubleClickListener = createMissableEventRegistry(context, "onDoubleClick")

  // Default mouse-events
  const addMouseDownListener = createDefaultEventRegistry(context, "onMouseDown")
  const addMouseUpListener = createDefaultEventRegistry(context, "onMouseUp")
  // Default pointer-events
  const addPointerDownListener = createDefaultEventRegistry(context, "onPointerDown")
  const addPointerUpListener = createDefaultEventRegistry(context, "onPointerUp")
  // Default wheel-event
  const addWheelListener = createDefaultEventRegistry(context, "onWheel", { passive: true })

  return {
    /**
     * Registers an `AugmentedElement<Object3D>` with the event handling system.
     *
     * @param object - The 3D object to register.
     * @param type - The type of event the object should listen for.
     */
    addEventListener(object: S3.Instance<Object3D>, type: S3.EventName) {
      switch (type) {
        // Missable Events
        case "onClick":
        case "onClickMissed":
          return addMissableClickListener(object)
        case "onContextMenu":
        case "onContextMenuMissed":
          return addMissableContextMenuListener(object)
        case "onDoubleClick":
        case "onDoubleClickMissed":
          return addMissableDoubleClickListener(object)

        // Hover Events
        case "onMouseEnter":
        case "onMouseLeave":
        case "onMouseMove":
          return addHoverMouseListener(object)
        case "onPointerEnter":
        case "onPointerLeave":
        case "onPointerMove":
          return addHoverPointerListener(object)

        // Default Events
        case "onMouseDown":
          return addMouseDownListener(object)
        case "onMouseUp":
          return addMouseUpListener(object)
        case "onPointerDown":
          return addPointerDownListener(object)
        case "onPointerUp":
          return addPointerUpListener(object)
        case "onWheel":
          return addWheelListener(object)
      }
    },
  }
}
