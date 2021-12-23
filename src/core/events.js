import * as THREE from "three";
function makeId(event) {
    return ((event.eventObject || event.object).uuid +
        "/" +
        event.index +
        event.instanceId);
}
// https://github.com/facebook/react/tree/main/packages/react-reconciler#getcurrenteventpriority
// Gives React a clue as to how import the current interaction is
// export function getEventPriority() {
//   let name = window?.event?.type;
//   switch (name) {
//     case "click":
//     case "contextmenu":
//     case "dblclick":
//     case "pointercancel":
//     case "pointerdown":
//     case "pointerup":
//       return DiscreteEventPriority;
//     case "pointermove":
//     case "pointerout":
//     case "pointerover":
//     case "pointerenter":
//     case "pointerleave":
//     case "wheel":
//       return ContinuousEventPriority;
//     default:
//       return DefaultEventPriority;
//   }
// }
/**
 * Release pointer captures.
 * This is called by releasePointerCapture in the API, and when an object is removed.
 */
function releaseInternalPointerCapture(capturedMap, obj, captures, pointerId) {
    const captureData = captures.get(obj);
    if (captureData) {
        captures.delete(obj);
        // If this was the last capturing object for this pointer
        if (captures.size === 0) {
            capturedMap.delete(pointerId);
            captureData.target.releasePointerCapture(pointerId);
        }
    }
}
export function removeInteractivity(store, object) {
    const { internal } = store.getState();
    // Removes every trace of an object from the data store
    internal.interaction = internal.interaction.filter((o) => o !== object);
    internal.initialHits = internal.initialHits.filter((o) => o !== object);
    internal.hovered.forEach((value, key) => {
        if (value.eventObject === object || value.object === object) {
            internal.hovered.delete(key);
        }
    });
    internal.capturedMap.forEach((captures, pointerId) => {
        releaseInternalPointerCapture(internal.capturedMap, object, captures, pointerId);
    });
}
export function createEvents(store) {
    const temp = new THREE.Vector3();
    /** Sets up defaultRaycaster */
    function prepareRay(event) {
        var _a, _b;
        const state = store.getState();
        const { raycaster, mouse, camera, size } = state;
        // https://github.com/pmndrs/react-three-fiber/pull/782
        // Events trigger outside of canvas when moved
        const { offsetX, offsetY } = (_b = (_a = raycaster.computeOffsets) === null || _a === void 0 ? void 0 : _a.call(raycaster, event, state)) !== null && _b !== void 0 ? _b : event;
        const { width, height } = size;
        mouse.set((offsetX / width) * 2 - 1, -(offsetY / height) * 2 + 1);
        raycaster.setFromCamera(mouse, camera);
    }
    /** Calculates delta */
    function calculateDistance(event) {
        const { internal } = store.getState();
        const dx = event.offsetX - internal.initialClick[0];
        const dy = event.offsetY - internal.initialClick[1];
        return Math.round(Math.sqrt(dx * dx + dy * dy));
    }
    /** Returns true if an instance has a valid pointer-event registered, this excludes scroll, clicks etc */
    function filterPointerEvents(objects) {
        return objects.filter((obj) => ["Move", "Over", "Enter", "Out", "Leave"].some((name) => {
            var _a;
            return (_a = obj.__r3f) === null || _a === void 0 ? void 0 : _a.handlers[("onPointer" + name)];
        }));
    }
    function intersect(filter) {
        var _a;
        const state = store.getState();
        const { raycaster, internal } = state;
        // Skip event handling when noEvents is set
        if (!raycaster.enabled)
            return [];
        const seen = new Set();
        const intersections = [];
        // Allow callers to eliminate event objects
        const eventsObjects = filter
            ? filter(internal.interaction)
            : internal.interaction;
        // Intersect known handler objects and filter against duplicates
        let intersects = raycaster
            .intersectObjects(eventsObjects, true)
            .filter((item) => {
            const id = makeId(item);
            if (seen.has(id))
                return false;
            seen.add(id);
            return true;
        });
        // https://github.com/mrdoob/three.js/issues/16031
        // Allow custom userland intersect sort order
        if (raycaster.filter)
            intersects = raycaster.filter(intersects, state);
        for (const intersect of intersects) {
            let eventObject = intersect.object;
            // Bubble event up
            while (eventObject) {
                if ((_a = eventObject.__r3f) === null || _a === void 0 ? void 0 : _a.eventCount)
                    intersections.push(Object.assign(Object.assign({}, intersect), { eventObject }));
                eventObject = eventObject.parent;
            }
        }
        return intersections;
    }
    /**  Creates filtered intersects and returns an array of positive hits */
    function patchIntersects(intersections, event) {
        const { internal } = store.getState();
        // If the interaction is captured, make all capturing targets  part of the
        // intersect.
        if ("pointerId" in event && internal.capturedMap.has(event.pointerId)) {
            for (let captureData of internal.capturedMap
                .get(event.pointerId)
                .values()) {
                intersections.push(captureData.intersection);
            }
        }
        return intersections;
    }
    /**  Handles intersections by forwarding them to handlers */
    function handleIntersects(intersections, event, delta, callback) {
        const { raycaster, mouse, camera, internal } = store.getState();
        // If anything has been found, forward it to the event listeners
        if (intersections.length) {
            const unprojectedPoint = temp.set(mouse.x, mouse.y, 0).unproject(camera);
            const localState = { stopped: false };
            for (const hit of intersections) {
                const hasPointerCapture = (id) => { var _a, _b; return (_b = (_a = internal.capturedMap.get(id)) === null || _a === void 0 ? void 0 : _a.has(hit.eventObject)) !== null && _b !== void 0 ? _b : false; };
                const setPointerCapture = (id) => {
                    const captureData = {
                        intersection: hit,
                        target: event.target,
                    };
                    if (internal.capturedMap.has(id)) {
                        // if the pointerId was previously captured, we add the hit to the
                        // event capturedMap.
                        internal.capturedMap.get(id).set(hit.eventObject, captureData);
                    }
                    else {
                        // if the pointerId was not previously captured, we create a map
                        // containing the hitObject, and the hit. hitObject is used for
                        // faster access.
                        internal.capturedMap.set(id, new Map([[hit.eventObject, captureData]]));
                    }
                    // Call the original event now
                    event.target.setPointerCapture(id);
                };
                const releasePointerCapture = (id) => {
                    const captures = internal.capturedMap.get(id);
                    if (captures) {
                        releaseInternalPointerCapture(internal.capturedMap, hit.eventObject, captures, id);
                    }
                };
                // Add native event props
                let extractEventProps = {};
                // This iterates over the event's properties including the inherited ones. Native PointerEvents have most of their props as getters which are inherited, but polyfilled PointerEvents have them all as their own properties (i.e. not inherited). We can't use Object.keys() or Object.entries() as they only return "own" properties; nor Object.getPrototypeOf(event) as that *doesn't* return "own" properties, only inherited ones.
                for (let prop in event) {
                    let property = event[prop];
                    // Only copy over atomics, leave functions alone as these should be
                    // called as event.nativeEvent.fn()
                    if (typeof property !== "function")
                        extractEventProps[prop] = property;
                }
                let raycastEvent = Object.assign(Object.assign(Object.assign({}, hit), extractEventProps), { spaceX: mouse.x, spaceY: mouse.y, intersections, stopped: localState.stopped, delta,
                    unprojectedPoint, ray: raycaster.ray, camera: camera, 
                    // Hijack stopPropagation, which just sets a flag
                    stopPropagation: () => {
                        // https://github.com/pmndrs/react-three-fiber/issues/596
                        // Events are not allowed to stop propagation if the pointer has been captured
                        const capturesForPointer = "pointerId" in event && internal.capturedMap.get(event.pointerId);
                        // We only authorize stopPropagation...
                        if (
                        // ...if this pointer hasn't been captured
                        !capturesForPointer ||
                            // ... or if the hit object is capturing the pointer
                            capturesForPointer.has(hit.eventObject)) {
                            raycastEvent.stopped = localState.stopped = true;
                            // Propagation is stopped, remove all other hover records
                            // An event handler is only allowed to flush other handlers if it is hovered itself
                            if (internal.hovered.size &&
                                Array.from(internal.hovered.values()).find((i) => i.eventObject === hit.eventObject)) {
                                // Objects cannot flush out higher up objects that have already caught the event
                                const higher = intersections.slice(0, intersections.indexOf(hit));
                                cancelPointer([...higher, hit]);
                            }
                        }
                    }, 
                    // there should be a distinction between target and currentTarget
                    target: {
                        hasPointerCapture,
                        setPointerCapture,
                        releasePointerCapture,
                    }, currentTarget: {
                        hasPointerCapture,
                        setPointerCapture,
                        releasePointerCapture,
                    }, sourceEvent: event, nativeEvent: event });
                // Call subscribers
                callback(raycastEvent);
                // Event bubbling may be interrupted by stopPropagation
                if (localState.stopped === true)
                    break;
            }
        }
        return intersections;
    }
    function cancelPointer(hits) {
        const { internal } = store.getState();
        Array.from(internal.hovered.values()).forEach((hoveredObj) => {
            var _a, _b;
            // When no objects were hit or the the hovered object wasn't found underneath the cursor
            // we call onPointerOut and delete the object from the hovered-elements map
            if (!hits.length ||
                !hits.find((hit) => hit.object === hoveredObj.object &&
                    hit.index === hoveredObj.index &&
                    hit.instanceId === hoveredObj.instanceId)) {
                const eventObject = hoveredObj.eventObject;
                const instance = eventObject.__r3f;
                const handlers = instance === null || instance === void 0 ? void 0 : instance.handlers;
                internal.hovered.delete(makeId(hoveredObj));
                if (instance === null || instance === void 0 ? void 0 : instance.eventCount) {
                    // Clear out intersects, they are outdated by now
                    const data = Object.assign(Object.assign({}, hoveredObj), { intersections: hits || [] });
                    (_a = handlers.onPointerOut) === null || _a === void 0 ? void 0 : _a.call(handlers, data);
                    (_b = handlers.onPointerLeave) === null || _b === void 0 ? void 0 : _b.call(handlers, data);
                }
            }
        });
    }
    const handlePointer = (name) => {
        // Deal with cancelation
        switch (name) {
            case "onPointerLeave":
            case "onPointerCancel":
                return () => cancelPointer([]);
            case "onLostPointerCapture":
                return (event) => {
                    const { internal } = store.getState();
                    if ("pointerId" in event &&
                        !internal.capturedMap.has(event.pointerId)) {
                        // If the object event interface had onLostPointerCapture, we'd call it here on every
                        // object that's getting removed.
                        internal.capturedMap.delete(event.pointerId);
                        cancelPointer([]);
                    }
                };
        }
        // Any other pointer goes here ...
        return (event) => {
            const { onPointerMissed, internal } = store.getState();
            prepareRay(event);
            internal.lastEvent.current = event;
            // Get fresh intersects
            const isPointerMove = name === "onPointerMove";
            const isClickEvent = name === "onClick" ||
                name === "onContextMenu" ||
                name === "onDoubleClick";
            const filter = isPointerMove ? filterPointerEvents : undefined;
            const hits = patchIntersects(intersect(filter), event);
            const delta = isClickEvent ? calculateDistance(event) : 0;
            // Save initial coordinates on pointer-down
            if (name === "onPointerDown") {
                internal.initialClick = [event.offsetX, event.offsetY];
                internal.initialHits = hits.map((hit) => hit.eventObject);
            }
            // If a click yields no results, pass it back to the user as a miss
            // Missed events have to come first in order to establish user-land side-effect clean up
            if (isClickEvent && !hits.length) {
                if (delta <= 2) {
                    pointerMissed(event, internal.interaction);
                    if (onPointerMissed)
                        onPointerMissed(event);
                }
            }
            // Take care of unhover
            if (isPointerMove)
                cancelPointer(hits);
            handleIntersects(hits, event, delta, (data) => {
                var _a, _b, _c;
                const eventObject = data.eventObject;
                const instance = eventObject.__r3f;
                const handlers = instance === null || instance === void 0 ? void 0 : instance.handlers;
                // Check presence of handlers
                if (!(instance === null || instance === void 0 ? void 0 : instance.eventCount))
                    return;
                if (isPointerMove) {
                    // Move event ...
                    if (handlers.onPointerOver ||
                        handlers.onPointerEnter ||
                        handlers.onPointerOut ||
                        handlers.onPointerLeave) {
                        // When enter or out is present take care of hover-state
                        const id = makeId(data);
                        const hoveredItem = internal.hovered.get(id);
                        if (!hoveredItem) {
                            // If the object wasn't previously hovered, book it and call its handler
                            internal.hovered.set(id, data);
                            (_a = handlers.onPointerOver) === null || _a === void 0 ? void 0 : _a.call(handlers, data);
                            (_b = handlers.onPointerEnter) === null || _b === void 0 ? void 0 : _b.call(handlers, data);
                        }
                        else if (hoveredItem.stopped) {
                            // If the object was previously hovered and stopped, we shouldn't allow other items to proceed
                            data.stopPropagation();
                        }
                    }
                    // Call mouse move
                    (_c = handlers.onPointerMove) === null || _c === void 0 ? void 0 : _c.call(handlers, data);
                }
                else {
                    // All other events ...
                    const handler = handlers[name];
                    if (handler) {
                        // Forward all events back to their respective handlers with the exception of click events,
                        // which must use the initial target
                        if (!isClickEvent || internal.initialHits.includes(eventObject)) {
                            // Missed events have to come first
                            pointerMissed(event, internal.interaction.filter((object) => !internal.initialHits.includes(object)));
                            // Now call the handler
                            handler(data);
                        }
                    }
                    else {
                        // Trigger onPointerMissed on all elements that have pointer over/out handlers, but not click and weren't hit
                        if (isClickEvent && internal.initialHits.includes(eventObject)) {
                            pointerMissed(event, internal.interaction.filter((object) => !internal.initialHits.includes(object)));
                        }
                    }
                }
            });
        };
    };
    function pointerMissed(event, objects) {
        objects.forEach((object) => { var _a, _b, _c; return (_c = (_a = object.__r3f) === null || _a === void 0 ? void 0 : (_b = _a.handlers).onPointerMissed) === null || _c === void 0 ? void 0 : _c.call(_b, event); });
    }
    return { handlePointer };
}
