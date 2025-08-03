import { onCleanup } from "solid-js"
import { type Intersection, Object3D } from "three"
import { S3 } from "./index.ts"
import { $S3C } from "./augment.ts"
import { isInstance } from "./utils/is-instance.ts"
import { removeElementFromArray } from "./utils/remove-element-from-array.ts"

/**
 * Checks if a given string is a valid event type within the system.
 *
 * @param type - The type of the event to check.
 * @returns `true` if the type is a recognized `EventType`, otherwise `false`.
 */
export const isEventType = (type: string): type is S3.EventName =>
  /^on(Pointer|Click|DoubleClick|ContextMenu|Wheel|Mouse)/.test(type)

/**
 * Initializes and manages event handling for `AugmentedElement<Object3D>`.
 *
 * @param context
 * @returns An object containing `addEventListener`-function and `eventRegistry`-object.
 */
export const createEvents = (context: S3.Context) => {
  /**
   * An object keeping track of all the `AugmentedElement<Object3D>` that are listening to a specific event.
   */
  const eventRegistry = {
    onMouseMove: [] as S3.Instance<Object3D>[],
    onMouseUp: [] as S3.Instance<Object3D>[],
    onMouseDown: [] as S3.Instance<Object3D>[],
    onPointerMove: [] as S3.Instance<Object3D>[],
    onPointerUp: [] as S3.Instance<Object3D>[],
    onPointerDown: [] as S3.Instance<Object3D>[],
    onWheel: [] as S3.Instance<Object3D>[],
    onClick: [] as S3.Instance<Object3D>[],
    onDoubleClick: [] as S3.Instance<Object3D>[],
  } as const

  // Creates a `ThreeEvent` from the current `MouseEvent` | `WheelEvent`.
  const createThreeEvent = <TEvent extends MouseEvent | WheelEvent>(
    nativeEvent: TEvent,
  ): S3.Event<TEvent> => {
    const event = {
      ...nativeEvent,
      nativeEvent,
      stopped: false,
      stopPropagation: () => (event.stopped = true),
    }
    return event
  }

  // Performs a raycast from the camera through the mouse position to find intersecting 3D objects.
  const raycast = <TNativeEvent extends MouseEvent | WheelEvent>(
    nativeEvent: TNativeEvent,
    type: keyof typeof eventRegistry,
  ): Intersection<S3.Instance<Object3D>>[] => {
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

  // Propagates an event down through the ancestors of a given `Object3D` in a scene graph,
  // calling the event handler for each ancestor as long as the event has not been marked as stopped.
  const bubbleDown = <
    TNativeEvent extends MouseEvent | WheelEvent,
    TEvent extends S3.Event<TNativeEvent>,
  >(
    element: S3.Instance<Object3D>,
    type: S3.EventName,
    event: TEvent,
  ) => {
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

  // A handler-factory for `on{Pointer|Mouse}Move` events.
  // This handler manages also its derived events:
  // - `on{Pointer|Mouse}Enter`
  // - `on{Pointer|Mouse}Leave`
  const createMoveHandler = (type: "Pointer" | "Mouse") => (nativeEvent: MouseEvent) => {
    const moveEvent = createThreeEvent(nativeEvent)
    const enterEvent = createThreeEvent(nativeEvent)

    let staleIntersects = new Set(priorIntersects[type])

    for (const intersection of raycast(nativeEvent, `on${type}Move`)) {
      const props = intersection.object[$S3C].props

      if (!enterEvent.stopped && !priorIntersects[type].has(intersection.object)) {
        // @ts-expect-error TODO: fix type-error
        props[`on${type}Enter`]?.(enterEvent)
        bubbleDown(intersection.object, `on${type}Enter`, enterEvent)
      }

      if (!moveEvent.stopped) {
        // @ts-expect-error TODO: fix type-error
        props[`on${type}Move`]?.(moveEvent)
        bubbleDown(intersection.object, `on${type}Move`, moveEvent)
      }

      staleIntersects.delete(intersection.object)
      priorIntersects[type].add(intersection.object)

      if (moveEvent.stopped && enterEvent.stopped) break
    }

    if (priorMoveEvents[type]) {
      const leaveEvent = createThreeEvent(priorMoveEvents[type]!)

      for (const object of staleIntersects.values()) {
        priorIntersects[type].delete(object)

        if (!leaveEvent.stopped) {
          const props = object[$S3C].props
          // @ts-expect-error TODO: fix type-error
          props[`on${type}Leave`]?.(leaveEvent)
          bubbleDown(object, `on${type}Leave`, leaveEvent)
        }
      }
    }

    priorMoveEvents[type] = nativeEvent
  }
  const priorIntersects = {
    Mouse: new Set<S3.Instance<Object3D>>(),
    Pointer: new Set<S3.Instance<Object3D>>(),
  }
  const priorMoveEvents = {
    Mouse: undefined as undefined | MouseEvent,
    Pointer: undefined as undefined | MouseEvent,
  }

  // Creates a generic event handler for events other than `move` and its derived events.
  const createEventHandler =
    <TEvent extends MouseEvent | WheelEvent>(type: keyof typeof eventRegistry) =>
    (nativeEvent: TEvent) => {
      const event = createThreeEvent(nativeEvent)
      for (const { object } of raycast(nativeEvent, type)) {
        // @ts-expect-error TODO: fix type-error
        object[$S3C].props?.[type]?.(event)
        bubbleDown(object, type, event)
        if (event.stopped) break
      }
    }

  // Register event handlers to the canvas
  context.canvas.addEventListener("mousemove", createMoveHandler("Mouse"))
  context.canvas.addEventListener("pointermove", createMoveHandler("Pointer"))

  context.canvas.addEventListener("mousedown", createEventHandler("onMouseDown"))
  context.canvas.addEventListener("pointerdown", createEventHandler("onPointerDown"))

  context.canvas.addEventListener("mouseup", createEventHandler("onMouseUp"))
  context.canvas.addEventListener("pointerup", createEventHandler("onPointerUp"))

  context.canvas.addEventListener("wheel", createEventHandler("onWheel"), { passive: true })
  context.canvas.addEventListener("click", createEventHandler("onClick"))
  context.canvas.addEventListener("dblclick", createEventHandler("onDoubleClick"))

  /**
   * Registers an `AugmentedElement<Object3D>` with the event handling system.
   *
   * @param object - The 3D object to register.
   * @param type - The type of event the object should listen for.
   */
  const addEventListener = (object: S3.Instance<Object3D>, type: S3.EventName) => {
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
          if ("onPointerMove" in props || "onPointerEnter" in props || "onPointerLeave" in props) {
            return
          }
        } else {
          if ("onMouseMove" in props || "onMouseEnter" in props || "onMouseLeave" in props) {
            return
          }
        }
      }

      // @ts-expect-error TODO: fix type-error
      removeElementFromArray(eventRegistry[type], object)
    })
  }

  return { addEventListener, eventRegistry }
}
