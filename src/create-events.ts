import { onCleanup } from "solid-js"
import { type Intersection, Object3D } from "three"
import { $S3C } from "./augment.ts"
import { S3 } from "./index.ts"
import { isInstance } from "./utils/is-instance.ts"
import { removeElementFromArray } from "./utils/remove-element-from-array.ts"

type EventRegistry = Record<S3.EventName, Array<S3.Instance<Object3D>>>

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
  eventRegistry: EventRegistry,
  nativeEvent: TNativeEvent,
  type: S3.EventName,
): Intersection<S3.Instance<Object3D>>[] {
  context.setPointer(pointer => {
    pointer.x = (nativeEvent.offsetX / globalThis.innerWidth) * 2 - 1
    pointer.y = -(nativeEvent.offsetY / globalThis.innerHeight) * 2 + 1
    return pointer
  })

  context.raycaster.setFromCamera(context.pointer, context.camera)

  const duplicates = new Set<S3.Instance<Object3D>>()

  // NOTE:  we currently perform a recursive intersection-test just as r3f.
  //        this method performs a lot of duplicate intersection-tests.
  const intersections: Intersection<S3.Instance<Object3D>>[] = context.raycaster.intersectObjects(
    eventRegistry[type],
    true,
  )

  return (
    intersections
      // sort by distance
      .sort((a, b) => a.distance - b.distance)
      // remove duplicates
      .filter(({ object }) => {
        if (duplicates.has(object)) return false
        duplicates.add(object)
        return true
      })
  )
}

/**********************************************************************************/
/*                                                                                */
/*                            Create Missable Event Handler                       */
/*                                                                                */
/**********************************************************************************/

/**
 * Handles click, double-click and contextmenu events with missed event support
 */
function createMissableEventHandler(context: S3.Context, eventRegistry: EventRegistry) {
  return (type: "onClick" | "onDoubleClick" | "onContextMenu") => {
    context.canvas.addEventListener(eventNameMap[type], nativeEvent => {
      const event = createThreeEvent(nativeEvent)
      const missedType = `${type}Missed` as const

      // Track which objects have been visited during event processing
      const visitedObjects = new Set<Object3D>()

      // Pass #1 - Process normal click events
      const intersections = raycast(context, eventRegistry, nativeEvent, type)

      for (const { object } of intersections) {
        let node: Object3D | null = object
        while (node && !event.stopped && !visitedObjects.has(node)) {
          visitedObjects.add(node)
          if (isInstance(node)) {
            node[$S3C].props?.[type]?.(event)
          }
          node = node.parent
        }
      }

      // Phase #2 - Raycast missedType-objects that haven't been visited
      for (const missedObject of eventRegistry[missedType]) {
        if (visitedObjects.has(missedObject)) {
          continue
        }

        // Perform raycast on unvisited missed objects
        context.raycaster.setFromCamera(context.pointer, context.camera)
        const missedIntersections = context.raycaster.intersectObject(missedObject, true)

        // Bubble down missed intersections
        // adding objects to visitedObjects, if they haven't been visited before
        for (const { object } of missedIntersections) {
          let node: Object3D | null = object
          while (node && !visitedObjects.has(node)) {
            visitedObjects.add(node)
            node = node.parent
          }
        }
      }

      // Pass #3 - Fire missed event-handler on remaining unvisited missedType-objects
      for (const object of eventRegistry[missedType]) {
        if (!visitedObjects.has(object)) {
          object[$S3C].props?.[missedType]?.(nativeEvent)
        }
      }
    })
  }
}

/**********************************************************************************/
/*                                                                                */
/*                            Create Movable Event Handler                        */
/*                                                                                */
/**********************************************************************************/

/**
 * A handler-factory for `on{Pointer|Mouse}Move` events.
 * This handler manages also its derived events:
 * - `on{Pointer|Mouse}Enter`
 * - `on{Pointer|Mouse}Leave`
 */
function createMovableEventHandler(context: S3.Context, eventRegistry: EventRegistry) {
  const priorMoveIntersects = {
    Mouse: new Set<S3.Instance<Object3D>>(),
    Pointer: new Set<S3.Instance<Object3D>>(),
  }
  const priorMoveEvents = {
    Mouse: undefined as undefined | MouseEvent,
    Pointer: undefined as undefined | MouseEvent,
  }

  return (type: "Pointer" | "Mouse") => {
    context.canvas.addEventListener(eventNameMap[`on${type}Move`], nativeEvent => {
      const moveEvent = createThreeEvent(nativeEvent)
      const enterEvent = createThreeEvent(nativeEvent)
      const staleIntersects = new Set(priorMoveIntersects[type])

      for (const intersection of raycast(context, eventRegistry, nativeEvent, `on${type}Move`)) {
        const props = intersection.object[$S3C].props

        // Handle enter-event
        if (!enterEvent.stopped && !priorMoveIntersects[type].has(intersection.object)) {
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
        priorMoveIntersects[type].add(intersection.object)

        if (moveEvent.stopped && enterEvent.stopped) break
      }

      // Handle leave-event
      if (priorMoveEvents[type]) {
        const leaveEvent = createThreeEvent(priorMoveEvents[type]!)

        for (const object of staleIntersects.values()) {
          priorMoveIntersects[type].delete(object)

          if (!leaveEvent.stopped) {
            const props = object[$S3C].props
            // @ts-expect-error TODO: fix type-error
            props[`on${type}Leave`]?.(leaveEvent)
            bubbleDown(object, `on${type}Leave`, leaveEvent)
          }
        }
      }

      priorMoveEvents[type] = nativeEvent
    })
  }
}

/**********************************************************************************/
/*                                                                                */
/*                             Create Default Event Handler                       */
/*                                                                                */
/**********************************************************************************/

function createDefaultEventHandler(context: S3.Context, eventRegistry: EventRegistry) {
  return (
    type: "onMouseDown" | "onPointerDown" | "onMouseUp" | "onPointerUp" | "onWheel",
    options?: AddEventListenerOptions,
  ) => {
    context.canvas.addEventListener(
      eventNameMap[type],
      nativeEvent => {
        const event = createThreeEvent(nativeEvent)
        const intersections = raycast(context, eventRegistry, nativeEvent, type)

        for (const { object } of intersections) {
          object[$S3C].props?.[type]?.(event)
          bubbleDown(object, type, event)
          if (event.stopped) break
        }
      },
      options,
    )
  }
}

/**********************************************************************************/
/*                                                                                */
/*                                  Create Events                                 */
/*                                                                                */
/**********************************************************************************/

/**
 * Initializes and manages event handling for `Instance<Object3D>`.
 */
export function createEvents(context: S3.Context) {
  const eventRegistry: Record<S3.EventName, Array<S3.Instance<Object3D>>> = {
    onClick: [],
    onClickMissed: [],
    onContextMenu: [],
    onContextMenuMissed: [],
    onDoubleClick: [],
    onDoubleClickMissed: [],
    onMouseDown: [],
    onMouseEnter: [],
    onMouseLeave: [],
    onMouseMove: [],
    onMouseUp: [],
    onPointerDown: [],
    onPointerEnter: [],
    onPointerLeave: [],
    onPointerMove: [],
    onPointerUp: [],
    onWheel: [],
  }

  const movableEventHandler = createMovableEventHandler(context, eventRegistry)
  const missableEventHandler = createMissableEventHandler(context, eventRegistry)
  const defaultEventHandler = createDefaultEventHandler(context, eventRegistry)

  movableEventHandler("Mouse")
  movableEventHandler("Pointer")

  missableEventHandler("onClick")
  missableEventHandler("onContextMenu")
  missableEventHandler("onDoubleClick")

  defaultEventHandler("onMouseDown")
  defaultEventHandler("onPointerDown")
  defaultEventHandler("onMouseUp")
  defaultEventHandler("onPointerUp")
  defaultEventHandler("onWheel", { passive: true })

  return {
    /**
     * An object keeping track of all the `AugmentedElement<Object3D>` that are listening to a specific event.
     */
    eventRegistry,
    /**
     * Registers an `AugmentedElement<Object3D>` with the event handling system.
     *
     * @param object - The 3D object to register.
     * @param type - The type of event the object should listen for.
     */
    addEventListener(object: S3.Instance<Object3D>, type: S3.EventName) {
      const isDerivedEvent = type.includes("Enter") || type.includes("Leave")
      const isPointerEvent = type.includes("Pointer")

      // Derived events are handled by `on{Pointer|Mouse}Move`
      const derivedType = isDerivedEvent ? `on${isPointerEvent ? "Pointer" : "Mouse"}Move` : type

      // @ts-expect-error TODO: fix type-error
      if (!eventRegistry[derivedType].find(value => value === object)) {
        // @ts-expect-error TODO: fix type-error
        eventRegistry[derivedType].push(object)
      }

      onCleanup(() => {
        // NOTE:  When a move/derived event-handler cleans up, it only removes the object from the registry
        //        if the object is currently not listening to another move/derived-event.
        if (derivedType.includes("Move")) {
          const props = object[$S3C].props ?? {}
          if (isPointerEvent) {
            if (
              "onPointerMove" in props ||
              "onPointerEnter" in props ||
              "onPointerLeave" in props
            ) {
              return
            }
          } else {
            if ("onMouseMove" in props || "onMouseEnter" in props || "onMouseLeave" in props) {
              return
            }
          }
        }

        // @ts-expect-error TODO: fix type-error
        removeElementFromArray(eventRegistry[derivedType], object)
      })
    },
  }
}
