// ../src/canvas.tsx
import { template as _$template } from "solid-js/web";
import { className as _$className } from "solid-js/web";
import { style as _$style } from "solid-js/web";
import { effect as _$effect } from "solid-js/web";
import { use as _$use } from "solid-js/web";

// ../node_modules/.pnpm/@solid-primitives+utils@6.4.0_solid-js@1.9.13/node_modules/@solid-primitives/utils/dist/index.js
import { getOwner, onCleanup, createSignal, untrack, sharedConfig, onMount, DEV, equalFn } from "solid-js";
import { isServer } from "solid-js/web";
var noop = (() => void 0);
var isNonNullable = (i) => i != null;
var filterNonNullable = (arr) => arr.filter(isNonNullable);
var access = (v) => typeof v === "function" && !v.length ? v() : v;
var asArray = (value) => Array.isArray(value) ? value : value ? [value] : [];
function handleDiffArray(current, prev, handleAdded, handleRemoved) {
  const currLength = current.length;
  const prevLength = prev.length;
  let i = 0;
  if (!prevLength) {
    for (; i < currLength; i++)
      handleAdded(current[i]);
    return;
  }
  if (!currLength) {
    for (; i < prevLength; i++)
      handleRemoved(prev[i]);
    return;
  }
  for (; i < prevLength; i++) {
    if (prev[i] !== current[i])
      break;
  }
  let prevEl;
  let currEl;
  prev = prev.slice(i);
  current = current.slice(i);
  for (prevEl of prev) {
    if (!current.includes(prevEl))
      handleRemoved(prevEl);
  }
  for (currEl of current) {
    if (!prev.includes(currEl))
      handleAdded(currEl);
  }
}

// ../node_modules/.pnpm/@solid-primitives+resize-observer@2.1.5_solid-js@1.9.13/node_modules/@solid-primitives/resize-observer/dist/index.js
import { createEffect, onCleanup as onCleanup2, sharedConfig as sharedConfig2 } from "solid-js";
import { isServer as isServer2 } from "solid-js/web";
function makeResizeObserver(callback, options) {
  if (isServer2) {
    return { observe: noop, unobserve: noop };
  }
  const observer = new ResizeObserver(callback);
  onCleanup2(observer.disconnect.bind(observer));
  return {
    observe: (ref) => observer.observe(ref, options),
    unobserve: observer.unobserve.bind(observer)
  };
}
function createResizeObserver(targets, onResize, options) {
  if (isServer2)
    return;
  const previousMap = /* @__PURE__ */ new WeakMap(), { observe, unobserve } = makeResizeObserver((entries) => {
    for (const entry of entries) {
      const { contentRect, target } = entry, width = Math.round(contentRect.width), height = Math.round(contentRect.height), previous = previousMap.get(target);
      if (!previous || previous.width !== width || previous.height !== height) {
        onResize(contentRect, target, entry);
        previousMap.set(target, { width, height });
      }
    }
  }, options);
  createEffect((prev) => {
    const refs = filterNonNullable(asArray(access(targets)));
    handleDiffArray(refs, prev, observe, unobserve);
    return refs;
  }, []);
}

// ../src/canvas.tsx
import { onMount as onMount2 } from "solid-js";
import { OrthographicCamera as OrthographicCamera3 } from "three";

// ../src/create-three.tsx
import { createComponent as _$createComponent } from "solid-js/web";
import { children as children2, createEffect as createEffect4, createMemo as createMemo4, createRenderEffect as createRenderEffect4, createResource as createResource2, createRoot, getOwner as getOwner4, untrack as untrack4, mergeProps as mergeProps4, onCleanup as onCleanup10 } from "solid-js";
import { ACESFilmicToneMapping, BasicShadowMap, Camera as Camera2, Clock, LinearSRGBColorSpace, NoToneMapping, OrthographicCamera as OrthographicCamera2, PCFShadowMap, PCFSoftShadowMap, PerspectiveCamera, Raycaster as Raycaster2, Scene, SRGBColorSpace, Vector3 as Vector34, VSMShadowMap, WebGLRenderer } from "three";

// ../src/create-events.ts
import { onCleanup as onCleanup5 } from "solid-js";
import "three";

// ../node_modules/.pnpm/@solid-primitives+map@0.7.3_solid-js@1.9.13/node_modules/@solid-primitives/map/dist/index.js
import { batch } from "solid-js";

// ../node_modules/.pnpm/@solid-primitives+trigger@1.2.3_solid-js@1.9.13/node_modules/@solid-primitives/trigger/dist/index.js
import { createSignal as createSignal2, getListener, onCleanup as onCleanup3, DEV as DEV2 } from "solid-js";
import { isServer as isServer3 } from "solid-js/web";
var triggerOptions = !isServer3 && DEV2 ? { equals: false, name: "trigger" } : { equals: false };
var triggerCacheOptions = !isServer3 && DEV2 ? { equals: false, internal: true } : triggerOptions;
var TriggerCache = class {
  #map;
  constructor(mapConstructor = Map) {
    this.#map = new mapConstructor();
  }
  dirty(key) {
    if (isServer3)
      return;
    this.#map.get(key)?.$$();
  }
  dirtyAll() {
    if (isServer3)
      return;
    for (const trigger of this.#map.values())
      trigger.$$();
  }
  track(key) {
    if (!getListener())
      return;
    let trigger = this.#map.get(key);
    if (!trigger) {
      const [$, $$] = createSignal2(void 0, triggerCacheOptions);
      this.#map.set(key, trigger = { $, $$, n: 1 });
    } else
      trigger.n++;
    onCleanup3(() => {
      if (--trigger.n === 0)
        queueMicrotask(() => trigger.n === 0 && this.#map.delete(key));
    });
    trigger.$();
  }
};

// ../node_modules/.pnpm/@solid-primitives+map@0.7.3_solid-js@1.9.13/node_modules/@solid-primitives/map/dist/index.js
var $OBJECT = Symbol("track-object");
var ReactiveMap = class extends Map {
  #keyTriggers = new TriggerCache();
  #valueTriggers = new TriggerCache();
  [Symbol.iterator]() {
    return this.entries();
  }
  constructor(entries) {
    super();
    if (entries)
      for (const entry of entries)
        super.set(...entry);
  }
  get size() {
    this.#keyTriggers.track($OBJECT);
    return super.size;
  }
  *keys() {
    this.#keyTriggers.track($OBJECT);
    for (const key of super.keys()) {
      yield key;
    }
  }
  *values() {
    this.#valueTriggers.track($OBJECT);
    for (const value of super.values()) {
      yield value;
    }
  }
  *entries() {
    this.#keyTriggers.track($OBJECT);
    this.#valueTriggers.track($OBJECT);
    for (const entry of super.entries()) {
      yield entry;
    }
  }
  forEach(callbackfn, thisArg) {
    this.#keyTriggers.track($OBJECT);
    this.#valueTriggers.track($OBJECT);
    super.forEach(callbackfn, thisArg);
  }
  has(key) {
    this.#keyTriggers.track(key);
    return super.has(key);
  }
  get(key) {
    this.#valueTriggers.track(key);
    return super.get(key);
  }
  set(key, value) {
    const hadNoKey = !super.has(key);
    const hasChanged = super.get(key) !== value;
    const result = super.set(key, value);
    if (hasChanged || hadNoKey) {
      batch(() => {
        if (hadNoKey) {
          this.#keyTriggers.dirty($OBJECT);
          this.#keyTriggers.dirty(key);
        }
        if (hasChanged) {
          this.#valueTriggers.dirty($OBJECT);
          this.#valueTriggers.dirty(key);
        }
      });
    }
    return result;
  }
  delete(key) {
    const isDefined = super.get(key) !== void 0;
    const result = super.delete(key);
    if (result) {
      batch(() => {
        this.#keyTriggers.dirty($OBJECT);
        this.#valueTriggers.dirty($OBJECT);
        this.#keyTriggers.dirty(key);
        if (isDefined) {
          this.#valueTriggers.dirty(key);
        }
      });
    }
    return result;
  }
  clear() {
    if (super.size === 0)
      return;
    batch(() => {
      this.#keyTriggers.dirty($OBJECT);
      this.#valueTriggers.dirty($OBJECT);
      for (const key of super.keys()) {
        this.#keyTriggers.dirty(key);
        this.#valueTriggers.dirty(key);
      }
      super.clear();
    });
  }
};

// ../src/pointer-capture.ts
var counts = new ReactiveMap();
var captureRegistry = {
  add(object) {
    counts.set(object, (counts.get(object) ?? 0) + 1);
  },
  delete(object) {
    const count = counts.get(object);
    if (count === void 0) return;
    if (count <= 1) counts.delete(object);
    else counts.set(object, count - 1);
  }
};
function hasPointerCapture(object) {
  return object != null && counts.has(object);
}

// ../src/pointer-managers.ts
import { Vector2 } from "three";

// ../src/pointers.ts
import { Plane, Vector3 as Vector32 } from "three";

// ../src/utils.ts
import { createRenderEffect, mergeProps, onCleanup as onCleanup4 } from "solid-js";
import {
  Vector3
} from "three";

// ../src/constants.ts
var $S3C = Symbol("solid-three");

// ../src/utils.ts
function isRecord(value) {
  return !Array.isArray(value) && typeof value === "object";
}
var isOrthographicCamera = (def) => "isOrthographicCamera" in def && !!def.isOrthographicCamera;
var isVector3 = (def) => "isVector3" in def && !!def.isVector3;
function autodispose(object) {
  if (object.dispose) {
    onCleanup4(() => object.dispose?.());
  }
  return object;
}
function meta(instance, augmentation = { props: {} }) {
  if (hasMeta(instance)) {
    return instance;
  }
  const _instance = instance;
  _instance[$S3C] = mergeProps(
    { children: /* @__PURE__ */ new Set(), parent: void 0 },
    augmentation
  );
  return _instance;
}
function getMeta(value) {
  return hasMeta(value) ? value[$S3C] : void 0;
}
function hasMeta(element) {
  return typeof element === "object" && element && $S3C in element;
}
async function awaitMapObject(object, callback) {
  const result = {};
  for (const key in object) {
    result[key] = await callback(object[key], key);
  }
  return result;
}
function bubbleUp(node, callback) {
  let current = node;
  while (current) {
    callback(current);
    current = "parent" in current ? current.parent : void 0;
  }
}
function defaultProps(props, defaults) {
  return mergeProps(defaults, props);
}
var hasColorSpace = (object) => "colorSpace" in object || "outputColorSpace" in object;
function isConstructor(value) {
  return typeof value === "function" && value.prototype !== void 0;
}
function isMaterial(value) {
  return !!value && value.isMaterial === true;
}
function isBufferGeometry(value) {
  return !!value && value.isBufferGeometry === true;
}
function isFog(value) {
  return !!value && value.isFog === true;
}
function isObject3D(value) {
  return !!value && value.isObject3D === true;
}
function isWritable(object, propertyName) {
  return Object.getOwnPropertyDescriptor(object, propertyName)?.writable;
}
function isRenderer(value) {
  return typeof value === "object" && value !== null && typeof value.render === "function" && typeof value.setSize === "function";
}
function isWebGLShadowMap(value) {
  return !!value && "needsUpdate" in value;
}
function getPendingInit(renderer) {
  const init = renderer.init;
  const hasInitialized = renderer.hasInitialized;
  if (typeof init !== "function") return void 0;
  if (hasInitialized?.call(renderer)) return void 0;
  return () => init.call(renderer);
}
var removeElementFromArray = (array, value) => {
  const index = array.indexOf(value);
  if (index !== -1) array.splice(index, 1);
  return array;
};
function resolve(child, recursive = false) {
  if (isConstructor(child)) {
    return child;
  }
  if (typeof child === "function") {
    const value = child();
    if (recursive) {
      return resolve(value);
    }
    return value;
  }
  return child;
}
function withContext(children3, context, value) {
  let result;
  context.Provider({
    value,
    children: (() => {
      result = children3();
      return "";
    })
  });
  return result;
}
function withMultiContexts(children3, values) {
  let result;
  values.reduce((acc, [context, value], index) => {
    return () => context.Provider({
      value,
      children: () => {
        if (index === 0) result = acc();
        else acc();
      }
    });
  }, children3)();
  return result;
}
async function load(loader, input) {
  if (isRecord(input)) {
    return await awaitMapObject(input, (path) => load(loader, path));
  }
  return new Promise((resolve3, reject) => loader.load(input, resolve3, void 0, reject));
}
function useRef(props, value) {
  createRenderEffect(() => {
    const result = typeof value === "function" ? (
      // @ts-expect-error — T may itself be callable; the Accessor branch is intended
      value()
    ) : value;
    if (typeof props.ref === "function") {
      const cleanup = props.ref(result);
      if (typeof cleanup === "function") onCleanup4(cleanup);
    } else {
      props.ref = result;
    }
  });
}
var tempTarget = new Vector3();
var position = new Vector3();
function getCurrentViewport(_camera, target, { width, height, top, left }) {
  const aspect = width / height;
  if (isVector3(target)) {
    tempTarget.copy(target);
  } else {
    tempTarget.set(...target);
  }
  const distance = _camera.getWorldPosition(position).distanceTo(tempTarget);
  if (isOrthographicCamera(_camera)) {
    return {
      width: width / _camera.zoom,
      height: height / _camera.zoom,
      top,
      left,
      factor: 1,
      distance,
      aspect
    };
  }
  const fov = _camera.fov * Math.PI / 180;
  const h = 2 * Math.tan(fov / 2) * distance;
  const w = h * (width / height);
  return { width: w, height: h, top, left, factor: width / w, distance, aspect };
}
function binarySearch(array, target) {
  let left = 0;
  let right = array.length;
  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    if (array[mid] < target) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }
  return left;
}

// ../src/pointers.ts
function createThreeEvent(nativeEvent, { stoppable = true, intersections } = {}) {
  const event = stoppable ? {
    nativeEvent,
    stopped: false,
    stopPropagation() {
      event.stopped = true;
    }
  } : { nativeEvent };
  if (intersections) {
    event.intersections = intersections;
    event.intersection = intersections[0];
    event.object = intersections[0]?.object;
  }
  return event;
}
var Pointer = class {
  constructor(context, raycaster, sink, captureRegistry2) {
    this.context = context;
    this.raycaster = raycaster;
    this.sink = sink;
    this.captureRegistry = captureRegistry2;
  }
  hovered = /* @__PURE__ */ new Set();
  hoveredCanvas = false;
  captured = null;
  /** Whether this pointer currently holds `object` captured. */
  hasCaptured(object) {
    return this.captured?.object === object;
  }
  /** Whether this pointer currently holds any capture. */
  get capturing() {
    return this.captured != null;
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
  capture(object, intersection, normalOverride) {
    if (!object) return;
    const normal = new Vector32();
    if (normalOverride) {
      normal.copy(normalOverride).normalize();
    } else if (intersection.face) {
      normal.copy(intersection.face.normal).transformDirection(intersection.object.matrixWorld);
    } else {
      this.context.camera.getWorldDirection(normal).negate();
    }
    const plane = new Plane().setFromNormalAndCoplanarPoint(normal, intersection.point);
    this.captured = { object, plane, intersection };
    try {
      this.sink?.capture();
    } catch {
      this.captured = null;
      return;
    }
    this.captureRegistry?.add(object);
  }
  /** Release a held capture and notify the OS sink. Idempotent. */
  release() {
    if (!this.captured) return;
    this.captureRegistry?.delete(this.captured.object);
    this.captured = null;
    this.sink?.release();
  }
  /** Clear capture state only, without notifying the sink (the OS already released). */
  dropCapture() {
    if (!this.captured) return;
    this.captureRegistry?.delete(this.captured.object);
    this.captured = null;
  }
  /**
   * The forced intersection for a captured pointer: intersect the live ray with
   * the stored plane for a fresh `point`/`distance`, keeping the original hit's
   * `face`/`uv`/`object`. Falls back to the stored hit when there's no forward
   * intersection — the ray is parallel to, or points away from, the plane.
   */
  reproject(captured) {
    this.raycaster.aim(this.context);
    const point = this.raycaster.ray.intersectPlane(captured.plane, new Vector32());
    if (!point) return captured.intersection;
    const distance = this.raycaster.ray.origin.distanceTo(point);
    return { ...captured.intersection, point, distance };
  }
  /** Attach the capture methods to a capturable event (down/up/move). */
  attachCapture(event) {
    event.setPointerCapture = (options) => {
      const object = options?.object ?? event.currentObject;
      if (!object) return;
      const intersection = event.currentIntersection ?? this.syntheticHit(object);
      this.capture(object, intersection, options?.normal);
    };
    event.releasePointerCapture = () => this.release();
    event.hasPointerCapture = (object) => {
      object ??= event.currentObject;
      return object != null && this.hasCaptured(object);
    };
  }
  /**
   * A contact for an explicit/deferred capture with no live ray hit: the object's
   * world-space centre, no face — so {@link capture} builds a camera-facing drag
   * plane through it. Used by `setPointerCapture({ object })` called after dispatch.
   */
  syntheticHit(object) {
    return { object, point: object.getWorldPosition(new Vector32()), distance: 0 };
  }
  /** Hover: enter/leave diff + bubbled `onPointerMove`, plus canvas-level. */
  move(nativeEvent) {
    if (this.captured) return this.dispatch("onPointerMove", nativeEvent, void 0, true);
    const intersections = this.raycaster.cast(this.context.eventRegistry, this.context);
    const props = this.context.props;
    const enterEvent = createThreeEvent(nativeEvent, { stoppable: false, intersections });
    const entered = /* @__PURE__ */ new Set();
    for (const intersection of intersections) {
      enterEvent.currentIntersection = intersection;
      let current = intersection.object;
      while (current && !entered.has(current)) {
        entered.add(current);
        if (!this.hovered.has(current)) getMeta(current)?.props?.onPointerEnter?.(enterEvent);
        current = current.parent;
      }
    }
    if (!this.hoveredCanvas) {
      this.hoveredCanvas = true;
      props.onPointerEnter?.(enterEvent);
    }
    const moveEvent = createThreeEvent(nativeEvent, { intersections });
    this.attachCapture(moveEvent);
    this.propagate(
      moveEvent,
      "onPointerMove",
      intersections.map((intersection) => [intersection, intersection.object])
    );
    const leaveEvent = createThreeEvent(nativeEvent, { stoppable: false, intersections });
    const previous = this.hovered;
    this.hovered = entered;
    for (const object of previous) {
      if (entered.has(object)) continue;
      getMeta(object)?.props?.onPointerLeave?.(leaveEvent);
    }
  }
  /** The pointer left the canvas/source: leave everything currently hovered. */
  leave(nativeEvent) {
    const leaveEvent = createThreeEvent(nativeEvent, { stoppable: false });
    this.context.props.onPointerLeave?.(leaveEvent);
    this.hoveredCanvas = false;
    for (const object of this.hovered) getMeta(object)?.props?.onPointerLeave?.(leaveEvent);
    this.hovered.clear();
  }
  down(nativeEvent) {
    this.dispatch("onPointerDown", nativeEvent, void 0, true);
  }
  up(nativeEvent) {
    this.dispatch("onPointerUp", nativeEvent, void 0, true);
  }
  wheel(nativeEvent) {
    this.dispatch("onWheel", nativeEvent);
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
  propagate(event, handler, roots) {
    const visited = /* @__PURE__ */ new Set();
    for (const [intersection, root] of roots) {
      event.currentIntersection = intersection;
      let node = root;
      while (node && !event.stopped && !visited.has(node)) {
        visited.add(node);
        event.currentObject = node;
        getMeta(node)?.props?.[handler]?.(event);
        node = node.parent;
      }
      if (event.stopped) break;
    }
    if (!event.stopped) {
      delete event.currentIntersection;
      event.currentObject = void 0;
      this.context.props[handler]?.(event);
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
  dispatch(handler, nativeEvent, extra, capturable = false) {
    const captured = this.captured;
    if (captured) {
      const intersection = this.reproject(captured);
      const event2 = createThreeEvent(nativeEvent, { intersections: [intersection] });
      if (extra) Object.assign(event2, extra);
      if (capturable) this.attachCapture(event2);
      this.propagate(event2, handler, [[intersection, captured.object]]);
      return;
    }
    const intersections = this.raycaster.cast(this.context.eventRegistry, this.context);
    const event = createThreeEvent(nativeEvent, { intersections });
    if (extra) Object.assign(event, extra);
    if (capturable) this.attachCapture(event);
    this.propagate(
      event,
      handler,
      intersections.map((intersection) => [intersection, intersection.object])
    );
  }
  /** Missable gesture: bubbled `onClick`/`onDoubleClick`/`onContextMenu` + `-Missed`. */
  click(kind, nativeEvent) {
    const missedType = `${kind}Missed`;
    const registry = this.context.eventRegistry;
    const props = this.context.props;
    if (registry.length === 0 && !props[kind] && !props[missedType]) return;
    const missed = new Set(registry);
    const visited = /* @__PURE__ */ new Set();
    const intersections = this.raycaster.cast(registry, this.context);
    const event = createThreeEvent(nativeEvent, { intersections });
    for (const intersection of intersections) {
      event.currentIntersection = intersection;
      let node = intersection.object;
      while (node && !event.stopped && !visited.has(node)) {
        missed.delete(node);
        visited.add(node);
        event.currentObject = node;
        getMeta(node)?.props?.[kind]?.(event);
        node = node.parent;
      }
    }
    if (!event.stopped) {
      delete event.currentIntersection;
      event.currentObject = void 0;
      props[kind]?.(event);
    }
    for (const remaining of missed) {
      const hits = this.raycaster.intersectObject(remaining, true);
      for (const { object } of hits) {
        let node = object;
        while (node && !visited.has(node)) {
          missed.delete(node);
          visited.add(node);
          node = node.parent;
        }
      }
    }
    const missedEvent = createThreeEvent(nativeEvent, { stoppable: false });
    for (const object of missed) getMeta(object)?.props?.[missedType]?.(missedEvent);
    if (intersections.length === 0) props[missedType]?.(missedEvent);
  }
};

// ../src/pointer-managers.ts
var DOMPointerManager = class {
  constructor(context, raycaster, captureRegistry2) {
    this.context = context;
    this.raycaster = raycaster;
    this.captureRegistry = captureRegistry2;
    this.primary = new Pointer(context, raycaster, void 0, captureRegistry2);
  }
  pointers = /* @__PURE__ */ new Map();
  primary;
  /** Pointers that moved while captured this gesture — i.e. dragged. */
  dragged = /* @__PURE__ */ new Set();
  /** A captured drag just ended; swallow its trailing click/dblclick/contextmenu. */
  suppressClick = false;
  /**
   * Release any pointer that currently holds `object` captured — called when the
   * object leaves the event registry (unmount / last handler removed) so a drag
   * doesn't keep dispatching to a detached node until the next pointerup. Uses
   * `release()` so the OS-level canvas capture is dropped too.
   */
  releaseCaptured(object) {
    for (const pointer of this.pointers.values()) {
      if (pointer.hasCaptured(object)) pointer.release();
    }
  }
  forId(id) {
    let pointer = this.pointers.get(id);
    if (!pointer) {
      const canvas = this.context.canvas;
      pointer = new Pointer(
        this.context,
        this.raycaster,
        {
          capture: () => canvas.setPointerCapture(id),
          release: () => {
            if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
          }
        },
        this.captureRegistry
      );
      this.pointers.set(id, pointer);
    }
    return pointer;
  }
  ndc(event) {
    const { width, height } = this.context.bounds;
    return new Vector2(event.offsetX / width * 2 - 1, -(event.offsetY / height) * 2 + 1);
  }
  /** Attach all canvas listeners; returns a disconnect that removes them. */
  connect() {
    const canvas = this.context.canvas;
    const aim = (event) => this.raycaster.setCursor(this.ndc(event));
    const onMove = (event) => {
      aim(event);
      const pointer = this.forId(event.pointerId);
      if (pointer.capturing) this.dragged.add(event.pointerId);
      pointer.move(event);
    };
    const onDown = (event) => {
      aim(event);
      this.suppressClick = false;
      this.dragged.delete(event.pointerId);
      this.forId(event.pointerId).down(event);
    };
    const onUp = (event) => {
      aim(event);
      this.forId(event.pointerId).up(event);
      if (this.dragged.delete(event.pointerId)) this.suppressClick = true;
      if (event.pointerType === "touch") {
        this.pointers.get(event.pointerId)?.leave(event);
        this.pointers.delete(event.pointerId);
      }
    };
    const onLeaveOrCancel = (event) => {
      this.forId(event.pointerId).leave(event);
      this.dragged.delete(event.pointerId);
      this.pointers.delete(event.pointerId);
    };
    const onClick = (event) => {
      if (this.suppressClick) return;
      aim(event);
      this.primary.click("onClick", event);
    };
    const onDoubleClick = (event) => {
      if (this.suppressClick) return;
      aim(event);
      this.primary.click("onDoubleClick", event);
    };
    const onContextMenu = (event) => {
      if (this.suppressClick) return;
      aim(event);
      this.primary.click("onContextMenu", event);
    };
    const onWheel = (event) => {
      aim(event);
      this.primary.wheel(event);
    };
    const onLostCapture = (event) => {
      this.pointers.get(event.pointerId)?.dropCapture();
    };
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointerleave", onLeaveOrCancel);
    canvas.addEventListener("pointercancel", onLeaveOrCancel);
    canvas.addEventListener("lostpointercapture", onLostCapture);
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("dblclick", onDoubleClick);
    canvas.addEventListener("contextmenu", onContextMenu);
    canvas.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointerleave", onLeaveOrCancel);
      canvas.removeEventListener("pointercancel", onLeaveOrCancel);
      canvas.removeEventListener("lostpointercapture", onLostCapture);
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("dblclick", onDoubleClick);
      canvas.removeEventListener("contextmenu", onContextMenu);
      canvas.removeEventListener("wheel", onWheel);
    };
  }
};

// ../src/raycasters.tsx
import { Quaternion, Raycaster, Vector2 as Vector22, Vector3 as Vector33 } from "three";
var CENTER = new Vector22(0, 0);
function castRegistry(raycaster, registry) {
  const nodeSet = /* @__PURE__ */ new Set();
  const visitedSet = /* @__PURE__ */ new Set();
  const stack = [...registry];
  for (const object of stack) {
    if (visitedSet.has(object)) continue;
    visitedSet.add(object);
    const meta2 = getMeta(object);
    if (meta2 && meta2.props.raycastable !== false) {
      nodeSet.add(object);
    }
    stack.push(...object.children);
  }
  return raycaster.intersectObjects(Array.from(nodeSet), false);
}
var CursorRaycaster = class extends Raycaster {
  pointer = new Vector22();
  setCursor(ndc) {
    this.pointer.copy(ndc);
  }
  aim(context) {
    this.setFromCamera(this.pointer, context.camera);
  }
  cast(registry, context) {
    this.aim(context);
    return castRegistry(this, registry);
  }
};
var CenterRaycaster = class extends Raycaster {
  pointer = new Vector22(0, 0);
  setCursor(_ndc) {
  }
  aim(context) {
    this.setFromCamera(CENTER, context.camera);
  }
  cast(registry, context) {
    this.aim(context);
    return castRegistry(this, registry);
  }
};
var ControllerRaycaster = class extends Raycaster {
  constructor(space) {
    super();
    this.space = space;
  }
  aim(_context) {
    this.space.updateMatrixWorld();
    const origin = new Vector33().setFromMatrixPosition(this.space.matrixWorld);
    const direction = new Vector33(0, 0, -1).applyQuaternion(new Quaternion().setFromRotationMatrix(this.space.matrixWorld)).normalize();
    this.ray.set(origin, direction);
  }
  cast(registry, context) {
    this.aim(context);
    return castRegistry(this, registry);
  }
};

// ../src/create-events.ts
var isEventType = (type) => /^on(Pointer|Click|DoubleClick|ContextMenu|Wheel)/.test(type);
function createEvents(context) {
  const candidate = context.raycaster;
  const screenRaycaster = "setCursor" in candidate && "cast" in candidate ? candidate : new CursorRaycaster();
  const manager = new DOMPointerManager(context, screenRaycaster, captureRegistry);
  onCleanup5(manager.connect());
  const refCounts = /* @__PURE__ */ new Map();
  function addToRegistry(object) {
    const count = refCounts.get(object) ?? 0;
    if (count === 0) context.eventRegistry.push(object);
    refCounts.set(object, count + 1);
    return () => {
      const current = refCounts.get(object);
      if (current === void 0) return;
      if (current <= 1) {
        refCounts.delete(object);
        const index = context.eventRegistry.indexOf(object);
        if (index !== -1) context.eventRegistry.splice(index, 1);
        queueMicrotask(() => {
          if (!refCounts.has(object)) manager.releaseCaptured(object);
        });
      } else {
        refCounts.set(object, current - 1);
      }
    };
  }
  return {
    /**
     * Registers an `AugmentedElement<Object3D>` with the pointer-event system.
     *
     * @param object - The 3D object to register.
     * @param _type - The handler type (accepted for API compatibility; the single
     *   registry is not keyed by type).
     */
    addEventListener(object, _type) {
      return addToRegistry(object);
    }
  };
}

// ../src/data-structure/stack.ts
import { createSignal as createSignal3, getOwner as getOwner2, onCleanup as onCleanup6, untrack as untrack2 } from "solid-js";
var Stack = class {
  constructor(name = "") {
    this.name = name;
    ;
    [this.#array, this.#setArray] = createSignal3([], {
      equals: false
    });
  }
  #array;
  #setArray;
  /**
   * Returns the complete stack.
   * @returns Returns the complete stack.
   */
  all() {
    return this.#array();
  }
  /**
   * Returns the top element of the stack without removing it.
   * @returns The top element of the stack.
   */
  peek() {
    const array = this.#array();
    const top = array[array.length - 1];
    return typeof top === "function" ? top() : top;
  }
  /**
   * Adds a value `T` or `Accessor<T>` to the stack.
   * Value is automatically removed from stack on cleanup.
   * @param value - The value to add to the stack.
   * @returns A cleanup function to remove the value from the stack.
   */
  push(value) {
    this.#setArray((array) => {
      const index = array.indexOf(value);
      if (index !== -1) array.splice(index, 1);
      array.push(value);
      return array;
    });
    if (true) {
      const array = untrack2(this.#array.bind(this));
      if (array.length > 2) {
        console.warn(
          `Stack ${this.name} has more then 2 entries:`,
          array,
          `This could lead to unexpected behavior: only the latest added value will be selected.`
        );
      }
      if (getOwner2() === null) {
        console.warn(
          `Value ${value} is added to stack ${this.name} outside a \`createRoot\` or \`render\`.
Remember to remove the element from the stack by calling the returned cleanup-function manually.`
        );
      }
    }
    onCleanup6(() => this.remove(value));
    return () => this.remove(value);
  }
  /**
   * Removes a value from the stack.
   * @private
   * @param value - The value to remove from the stack.
   */
  remove(value) {
    this.#setArray((array) => {
      const index = array.indexOf(value);
      if (index === -1) return array;
      array.splice(index, 1);
      return array;
    });
  }
};

// ../src/hooks.ts
import {
  createContext,
  createMemo,
  createResource,
  mergeProps as mergeProps2,
  useContext
} from "solid-js";
import "three";

// ../src/data-structure/loader-cache.ts
import { getOwner as getOwner3, onCleanup as onCleanup7 } from "solid-js";

// ../src/data-structure/tree-registry.ts
var TreeNode = class {
  constructor(key, parent) {
    this.key = key;
    this.parent = parent;
  }
  children = /* @__PURE__ */ new Map();
  count = 0;
  data;
  delete() {
    this.parent.children.delete(this.key);
  }
};
var TreeRegistry = class _TreeRegistry {
  /** Map of child nodes at the root level */
  children = /* @__PURE__ */ new Map();
  /** Count of data nodes in this tree */
  count = 0;
  #resolve(input, autocreate) {
    const paths = Array.isArray(input) ? input : [input];
    let current = this;
    for (let i = 0; i < paths.length; i++) {
      let node = current.children.get(paths[i]);
      if (!node) {
        if (!autocreate) {
          return void 0;
        }
        node = new TreeNode(paths[i], current);
        current.children.set(paths[i], node);
      }
      current = node;
    }
    if (current instanceof _TreeRegistry) {
      throw new Error(`Invalid resolution: ${paths}`);
    }
    return current;
  }
  /**
   * Retrieves data stored at the specified path.
   * @param input Path as a string or array of strings
   * @returns The data stored at the path, or undefined if not found
   */
  get(input, warn = true) {
    const node = this.#resolve(input, false);
    if (!node) {
      if (warn) {
        console.warn("Invalid path", input);
      }
      return void 0;
    }
    return node.data;
  }
  /**
   * Stores data at the specified path, creating nodes as needed.
   * Automatically increments reference counts up the tree when storing new data.
   * @param input Path as a string or array of strings
   * @param data The data to store
   */
  set(input, data) {
    const node = this.#resolve(input, true);
    if (!node.data) {
      bubbleUp(node, (node2) => node2.count++);
    }
    node.data = data;
  }
  /**
   * Deletes data at the specified path and cleans up empty branches.
   * Automatically decrements reference counts and removes nodes with zero references.
   * @param input Path as a string or array of strings
   */
  delete(input) {
    const node = this.#resolve(input, false);
    if (!node) {
      console.warn("Invalid path", input);
      return;
    }
    bubbleUp(node, (node2) => {
      node2.count--;
      if (node2 instanceof TreeNode && node2.count === 0) {
        node2.delete();
      }
    });
  }
};

// ../src/data-structure/loader-cache.ts
var LoaderCache = class {
  /** Map of loader instances to their respective tree registries */
  #treeRegistryMap = /* @__PURE__ */ new Map();
  /** Weak map for reverse lookup from data to cache nodes */
  #dataMap = /* @__PURE__ */ new WeakMap();
  /** Set of resources that do not have active references and can be safely cleaned up. */
  freeList = /* @__PURE__ */ new Set();
  /**
   * Gets or creates a tree registry for a specific loader.
   * @param loader The Three.js loader instance
   * @returns The tree registry for this loader
   * @private
   */
  #registry(loader) {
    let registry = this.#treeRegistryMap.get(loader);
    if (!registry) {
      this.#treeRegistryMap.set(
        loader,
        registry = new TreeRegistry()
      );
    }
    return registry;
  }
  /**
   * Deletes a cache node and its associated resource.
   * @param node The cache node to delete
   * @param options.force Force deletion even if not in free list
   * @private
   */
  #delete(node, { force } = {}) {
    if (!force && !this.freeList.has(node.data)) {
      console.error(
        `Attempting to delete a non-freed resource. Use { force: true } if you are sure you want to dispose`,
        node.data
      );
      return;
    }
    node.dispose();
  }
  /**
   * Disposes all resources in the free list.
   * Should be called periodically to clean up unused resources.
   */
  disposeFreeList() {
    this.freeList.forEach((resource) => this.#dataMap.get(resource)?.dispose());
  }
  /**
   * Manually deletes a specific resource from the cache.
   * @param resource The resource object to delete
   * @param options.force Force deletion even if resource has active references
   */
  disposeResource(resource, options) {
    const node = this.#dataMap.get(resource);
    if (!node) {
      console.error(`Error while deleting resource ${resource}. Could not find CacheNode.`);
      return;
    }
    this.#delete(node, options);
  }
  /**
   * Removes a resource from a specific loader's cache at the given path.
   * @param loader The Three.js loader instance
   * @param url The URL or path to the resource
   * @param options.force Force deletion even if resource has active references
   */
  delete(loader, url, options) {
    const node = this.#registry(loader).get(url);
    if (!node) {
      console.error(`Error while deleting path ${url}. Could not find CacheNode.`);
      return;
    }
    this.#delete(node, options);
  }
  /**
   * Retrieves a resource from the cache and tracks its usage.
   * Automatically integrates with Solid.js cleanup for reference counting.
   * @param loader The Three.js loader instance
   * @param url The URL or path to the resource
   * @returns The resource promise, resolved data, or undefined if not found
   */
  get(loader, url, warn) {
    const node = this.#registry(loader).get(url, warn);
    if (!node) return void 0;
    return node.data;
  }
  /**
   * Stores a resource in the cache at the specified path.
   * @param loader The Three.js loader instance
   * @param path The URL or path to store the resource at
   * @param data The resource promise to cache
   * @param options.force Force update even if resource already exists
   * @returns The stored promise
   */
  set(loader, path, data, options) {
    const registry = this.#registry(loader);
    let node = registry.get(path, false);
    if (node) {
      node.update(data, options);
    } else {
      node = new CacheNode(this.freeList, registry, path, data);
      this.#dataMap.set(data, node);
      registry.set(path, node);
    }
    return data;
  }
};
var CacheNode = class {
  /**
   * Creates a new cache node.
   * @param free The global free list for deferred disposal
   * @param registry The tree registry containing this node
   * @param path The path where this resource is stored
   * @param promise The resource promise to cache
   */
  constructor(free, registry, path, promise) {
    this.free = free;
    this.registry = registry;
    this.path = path;
    this.data = promise;
    this.#set(promise);
  }
  /** Reference count for this resource */
  count = 0;
  /** The cached resource (promise or resolved value) */
  data;
  /**
   * Sets the promise and handles resolution.
   * @param promise The resource promise
   * @private
   */
  #set(promise) {
    this.data = promise;
    Promise.resolve(promise).then((value) => {
      if (this.data === promise) {
        this.data = value;
      }
    });
  }
  /**
   * Disposes the Three.js resource if it has a dispose method.
   * @private
   */
  #dispose() {
    if (isRecord(this.data) && "dispose" in this.data && typeof this.data.dispose === "function") {
      this.data.dispose();
    }
  }
  /**
   * Deletes this node and disposes its resource.
   */
  dispose() {
    this.#dispose();
    this.registry.delete(this.path);
  }
  /**
   * Tracks usage of this resource within a Solid.js reactive context.
   * Automatically increments reference count and schedules cleanup on component unmount.
   */
  track() {
    if (this.count === 0) {
      this.free.delete(this.data);
    }
    this.count++;
    if (!getOwner3()) {
      console.warn(
        "Cached resources accessed outside of reactive context will not be automatically freed.",
        this
      );
    } else {
      onCleanup7(() => {
        this.count -= 1;
        if (this.count <= 0) {
          this.free.add(this.data);
        }
      });
    }
  }
  /**
   * Updates the cached resource with new data.
   * @param data The new resource promise
   * @param options.force Force update and dispose current resource (default: true)
   */
  update(data, { force = true } = {}) {
    if (this.data !== data && !force) {
      console.error(
        "Attempted to update already set resource. To overwrite and dispose of current resource, use { force: true } instead."
      );
    } else {
      this.#dispose();
      this.#set(data);
      this.registry.set(this.path, this);
    }
  }
};

// ../src/hooks.ts
var frameContext = createContext();
var useFrame = (callback, options) => {
  const addFrameListener = useContext(frameContext);
  if (!addFrameListener) {
    throw new Error("S3: Hooks can only be used within the Canvas component!");
  }
  return addFrameListener(callback, options);
};
var threeContext = createContext(null);
function useThree(callback) {
  const store = useContext(threeContext);
  if (!store) {
    throw new Error("S3: Hooks can only be used within the Canvas component!");
  }
  if (callback) return () => callback(store);
  return store;
}
var LOADER_CACHE = /* @__PURE__ */ new Map();
function resolveUrls(base, url) {
  if (Array.isArray(url)) {
    return url.map((url2) => new URL(url2, base).href);
  } else if (isRecord(url)) {
    return Object.fromEntries(
      Object.entries(url).map(([key, url2]) => [key, resolveUrls(base, url2)])
    );
  } else if (typeof url === "string") {
    return new URL(url, base).href;
  }
  throw new Error("Unexpected type");
}
function useLoader(constructor, url, options) {
  const config = mergeProps2({ cache: true }, options);
  const loader = createMemo(() => {
    const _constructor = resolve(constructor);
    let loader2 = LOADER_CACHE.get(_constructor);
    if (!loader2) {
      LOADER_CACHE.set(_constructor, loader2 = new _constructor());
    }
    return loader2;
  });
  function getOrInsert(registry, loader2, input) {
    if (isRecord(input)) {
      return awaitMapObject(input, async (value) => getOrInsert(registry, loader2, value));
    } else {
      const _input = input;
      const cachedPromise = registry.get(loader2, _input, false);
      if (cachedPromise) {
        return cachedPromise;
      }
      const promise = load(loader2, _input);
      registry.set(loader2, _input, promise);
      return promise;
    }
  }
  function loadUrl(url2) {
    if (config.cache === true) {
      if (!useLoader.cache) {
        return load(loader(), url2);
      }
      return getOrInsert(useLoader.cache, loader(), url2);
    }
    if (config.cache) {
      return getOrInsert(config.cache, loader(), url2);
    }
    return load(loader(), url2);
  }
  const [resource] = createResource(
    () => [resolve(url), options?.base, loader()],
    async ([url2, base, loader2]) => {
      config.onBeforeLoad?.(loader2);
      url2 = base ? resolveUrls(base, url2) : url2;
      const result = await loadUrl(url2);
      config.onLoad?.(result);
      return result;
    }
  );
  return resource;
}
useLoader.cache = new LoaderCache();

// ../src/internal-context.ts
import { createContext as createContext2, useContext as useContext2 } from "solid-js";
import "three";
var addToEventListeners = (object, type) => {
  const addToEventListeners2 = useContext2(eventContext);
  if (!addToEventListeners2) {
    throw new Error("S3: Hooks can only be used within the Canvas component!");
  }
  return addToEventListeners2(object, type);
};
var eventContext = createContext2();
var portalContext = createContext2();

// ../src/props.ts
import {
  children,
  createComputed,
  createRenderEffect as createRenderEffect2,
  mapArray,
  onCleanup as onCleanup8,
  splitProps,
  untrack as untrack3
} from "solid-js";
import {
  Color,
  RGBAFormat,
  Texture as Texture2,
  UnsignedByteType
} from "three";

// ../src/plugin.ts
var plugin = (selectorOrMethods, methods) => {
  if (methods === void 0) {
    return (element) => selectorOrMethods(element);
  }
  return (element) => {
    if (Array.isArray(selectorOrMethods)) {
      for (const Ctor of selectorOrMethods) {
        if (element instanceof Ctor) return methods(element);
      }
      return void 0;
    }
    if (typeof selectorOrMethods === "function" && selectorOrMethods(element)) {
      return methods(element);
    }
    return void 0;
  };
};
function resolvePluginMethods(element, plugins) {
  const merged = {};
  for (const plugin2 of plugins) {
    const result = plugin2(element);
    if (!result) continue;
    for (const key in result) {
      const descriptor = Object.getOwnPropertyDescriptor(result, key);
      if (descriptor?.get || descriptor?.set) Object.defineProperty(merged, key, descriptor);
      else merged[key] = result[key];
    }
  }
  return merged;
}

// ../src/props.ts
function applySceneGraph(parent, child) {
  const parentMeta = getMeta(parent);
  if (parentMeta) {
    parentMeta.children.add(child);
    onCleanup8(() => parentMeta.children.delete(child));
  }
  const childMeta = getMeta(child);
  if (childMeta) {
    childMeta.parent = parent;
    onCleanup8(() => childMeta.parent = void 0);
  }
  let attachProp = childMeta?.props.attach;
  if (typeof attachProp === "function") {
    const cleanup = attachProp(parent, child);
    onCleanup8(cleanup);
    return;
  }
  if (!attachProp) {
    if (isMaterial(child)) attachProp = "material";
    else if (isBufferGeometry(child)) attachProp = "geometry";
    else if (isFog(child)) attachProp = "fog";
  }
  if (attachProp) {
    let target = parent;
    let property;
    const path = attachProp.split("-");
    while (property = path.shift()) {
      if (path.length === 0) {
        target[property] = child;
        onCleanup8(() => target[property] = void 0);
        break;
      } else {
        target = target[property];
      }
    }
    return;
  }
  if (isObject3D(child) && isObject3D(parent)) return;
  console.error(
    "Error while connecting/attaching child: child does not have attach-props defined and is not an Object3D",
    parent,
    child
  );
}
var useSceneGraph = (_parent, props) => {
  const c = children(() => props.children);
  createComputed(
    mapArray(
      () => c.toArray(),
      (_child) => createComputed(() => {
        const parent = resolve(_parent);
        if (!parent) return;
        const child = resolve(_child);
        if (!child) return;
        applySceneGraph(parent, child);
        props.onUpdate?.(parent);
      })
    )
  );
  createComputed((previousManagedChildren) => {
    const parent = resolve(_parent);
    if (!isObject3D(parent)) {
      return previousManagedChildren;
    }
    const childArray = c.toArray();
    const managedChildren = /* @__PURE__ */ new Set();
    for (const child of childArray) {
      if (!isObject3D(child) || getMeta(child)?.props.attach) continue;
      managedChildren.add(child);
      if (child.parent !== parent) {
        parent.add(child);
      }
    }
    for (const child of previousManagedChildren) {
      if (!managedChildren.has(child)) {
        parent.remove(child);
      }
    }
    let childArrayIndex = 0;
    for (let i = 0; i < parent.children.length; i++) {
      if (!managedChildren.has(parent.children[i])) {
        continue;
      }
      while (childArrayIndex < childArray.length) {
        const child = childArray[childArrayIndex++];
        if (isObject3D(child) && !getMeta(child)?.props.attach) {
          parent.children[i] = child;
          break;
        }
      }
    }
    return managedChildren;
  }, /* @__PURE__ */ new Set());
};
var NEEDS_UPDATE = [
  "map",
  "envMap",
  "bumpMap",
  "normalMap",
  "transparent",
  "morphTargets",
  "skinning",
  "alphaTest",
  "useVertexColors",
  "flatShading"
];
function applyProp(context, source, type, value, pluginMethods) {
  if (type in pluginMethods) {
    pluginMethods[type](value);
    return;
  }
  if (!source) {
    console.error("error while applying prop", source, type, value);
    return;
  }
  if (value === void 0) return;
  if (type.indexOf("-") > -1) {
    const [property, ...rest] = type.split("-");
    applyProp(context, source[property], rest.join("-"), value, pluginMethods);
    return;
  }
  if (NEEDS_UPDATE.includes(type) && (!source[type] && value || source[type] && !value)) {
    source.needsUpdate = true;
  }
  if (hasColorSpace(source)) {
    const sRGBEncoding = 3001;
    const SRGBColorSpace2 = "srgb";
    const LinearSRGBColorSpace2 = "srgb-linear";
    if (type === "encoding") {
      type = "colorSpace";
      value = value === sRGBEncoding ? SRGBColorSpace2 : LinearSRGBColorSpace2;
    } else if (type === "outputEncoding") {
      type = "outputColorSpace";
      value = value === sRGBEncoding ? SRGBColorSpace2 : LinearSRGBColorSpace2;
    }
  }
  if (isEventType(type)) {
    if (isObject3D(source) && hasMeta(source)) {
      const cleanup = addToEventListeners(source, type);
      onCleanup8(cleanup);
    } else {
      console.error(
        "Event handlers can only be added to Three elements extending from Object3D. Ignored event-type:",
        type,
        "from element",
        source
      );
    }
    return;
  }
  const target = source[type];
  try {
    if (target?.copy && target?.constructor === value?.constructor && !isWritable(source, type)) {
      target.copy(value);
    } else if (target?.set && Array.isArray(value)) {
      if (target.fromArray) target.fromArray(value);
      else target.set(...value);
    } else if (target?.set && typeof value !== "object") {
      const isColor = target instanceof Color;
      if (!isColor && target.setScalar && typeof value === "number") {
        target.setScalar(value);
      } else if (value !== void 0) {
        target.set(value);
      }
    } else {
      source[type] = value;
      if (source[type] instanceof Texture2 && // sRGB textures must be RGBA8 since r137 https://github.com/mrdoob/three.js/pull/23129
      source[type].format === RGBAFormat && source[type].type === UnsignedByteType) {
        createRenderEffect2(() => {
          context.props.linear;
          context.props.flat;
          const texture = source[type];
          if (hasColorSpace(texture) && hasColorSpace(context.gl)) {
            texture.colorSpace = context.gl.outputColorSpace;
          } else {
            texture.encoding = context.gl.outputEncoding;
          }
        });
      }
    }
  } finally {
    if ("needsUpdate" in source) {
      source.needsUpdate = true;
    }
    if (context.props.frameloop === "demand") {
      context.requestRender();
    }
  }
}
var EMPTY_METHODS = {};
function useProps(accessor, props, context = useThree(), plugins = []) {
  const [local, instanceProps] = splitProps(props, ["ref", "args", "object", "attach", "children"]);
  createRenderEffect2(() => {
    const object = resolve(accessor);
    if (!object) return;
    if (local.ref instanceof Function) local.ref(object);
    else local.ref = object;
  });
  useSceneGraph(accessor, props);
  createRenderEffect2(() => {
    const object = resolve(accessor);
    if (!object) return;
    let pluginMethods = EMPTY_METHODS;
    if (plugins.length) {
      pluginMethods = resolvePluginMethods(object, plugins);
      const childMeta = getMeta(object);
      if (childMeta) childMeta.ctx = context;
    }
    createRenderEffect2(() => {
      const keys2 = Object.keys(instanceProps);
      for (const key of keys2) {
        const subKeys = keys2.filter((_key) => key !== _key && _key.includes(key));
        createRenderEffect2(() => {
          applyProp(context, object, key, props[key], pluginMethods);
          for (const subKey of subKeys) {
            applyProp(context, object, subKey, props[subKey], pluginMethods);
          }
        });
      }
      untrack3(() => props.onUpdate)?.(object);
    });
  });
}

// ../node_modules/.pnpm/@bigmistqke+solid-whenever@0.1.1_solid-js@1.9.13/node_modules/@bigmistqke/solid-whenever/dist/index.js
import { createMemo as createMemo2, createEffect as createEffect2, createRenderEffect as createRenderEffect3, createComputed as createComputed2 } from "solid-js";
function resolve2(value) {
  return typeof value !== "function" ? value : value();
}
var check = (accessor, callback, fallback) => {
  const value = resolve2(accessor);
  return value ? callback(value) : fallback ? fallback() : void 0;
};
var when = (accessor, callback, fallback) => {
  return (...args) => check(
    accessor,
    (value) => callback(value, ...args),
    fallback ? () => fallback(...args) : void 0
  );
};
function whenify(fn) {
  return function(accessor, callback, fallback) {
    return fn(when(accessor, callback, fallback));
  };
}
var whenMemo = whenify(createMemo2);
var whenEffect = whenify(createEffect2);
var whenRenderEffect = whenify(createRenderEffect3);
var whenComputed = whenify(createComputed2);

// ../src/utils/use-measure.ts
import { createEffect as createEffect3, createMemo as createMemo3, createSignal as createSignal4, mergeProps as mergeProps3, onCleanup as onCleanup9 } from "solid-js";

// ../src/utils/debounce.ts
function debounce(callback, wait = 100, options = {}) {
  if (typeof callback !== "function") {
    throw new TypeError(
      `Expected the first parameter to be a function, got \`${typeof callback}\`.`
    );
  }
  if (wait < 0) {
    throw new RangeError("`wait` must not be negative.");
  }
  const { immediate } = options;
  let storedContext;
  let storedArguments;
  let timeoutId;
  let timestamp;
  let result;
  function run() {
    const callContext = storedContext;
    const callArguments = storedArguments;
    storedContext = void 0;
    storedArguments = void 0;
    result = callback.apply(callContext, callArguments);
    return result;
  }
  function later() {
    const last = Date.now() - timestamp;
    if (last < wait && last >= 0) {
      timeoutId = setTimeout(later, wait - last);
    } else {
      timeoutId = void 0;
      if (!immediate) {
        result = run();
      }
    }
  }
  function debounced(...args) {
    if (storedContext && this !== storedContext) {
      throw new Error("Debounced method called with different contexts.");
    }
    storedContext = this;
    storedArguments = args;
    timestamp = Date.now();
    const callNow = immediate && !timeoutId;
    if (!timeoutId) {
      timeoutId = setTimeout(later, wait);
    }
    if (callNow) {
      result = run();
    }
    return result;
  }
  debounced.clear = () => {
    if (!timeoutId) return;
    clearTimeout(timeoutId);
    timeoutId = void 0;
  };
  debounced.flush = () => {
    if (!timeoutId) return;
    debounced.trigger();
  };
  debounced.trigger = () => {
    result = run();
    debounced.clear();
  };
  return debounced;
}

// ../src/utils/use-measure.ts
function useMeasure(options) {
  const config = mergeProps3(
    {
      debounce: 0,
      scroll: false,
      offsetSize: false
    },
    options
  );
  const ResizeObserver2 = config.polyfill || (typeof globalThis === "undefined" ? class ResizeObserver {
  } : globalThis.ResizeObserver);
  if (!ResizeObserver2) {
    throw new Error(
      "This browser does not support ResizeObserver out of the box. See: https://github.com/react-spring/react-use-measure/#resize-observer-polyfills"
    );
  }
  const [element, setElement] = createSignal4(null);
  const [bounds, setBounds] = createSignal4({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    bottom: 0,
    right: 0,
    x: 0,
    y: 0
  });
  const scrollContainers = createMemo3(() => findScrollContainers(element()));
  let lastBounds;
  const getDebounce = (type) => {
    const debounce2 = config.debounce ? typeof config.debounce === "number" ? config.debounce : config.debounce[type] : null;
    if (debounce2) return debounce(forceRefresh, debounce2);
    return forceRefresh;
  };
  const forceRefresh = when(element, (element2) => {
    const { left, top, width, height, bottom, right, x, y } = element2.getBoundingClientRect();
    const bounds2 = {
      left,
      top,
      width,
      height,
      bottom,
      right,
      x,
      y
    };
    if (element2 instanceof HTMLElement && config.offsetSize) {
      bounds2.height = element2.offsetHeight;
      bounds2.width = element2.offsetWidth;
    }
    Object.freeze(bounds2);
    if (!lastBounds || !areBoundsEqual(lastBounds, bounds2)) {
      lastBounds = bounds2;
      setBounds(bounds2);
    }
  });
  createEffect3(() => {
    const onScroll = getDebounce("scroll");
    createEffect3(() => {
      if (!config.scroll) return;
      globalThis.addEventListener("scroll", onScroll, { capture: true, passive: true });
      onCleanup9(() => globalThis.removeEventListener("scroll", onScroll, true));
    });
    whenEffect(scrollContainers, (scrollContainers2) => {
      if (!config.scroll) return;
      scrollContainers2.forEach(
        (scrollContainer) => scrollContainer.addEventListener("scroll", onScroll, {
          capture: true,
          passive: true
        })
      );
      onCleanup9(() => {
        scrollContainers2.forEach((element2) => {
          element2.removeEventListener("scroll", onScroll, true);
        });
      });
    });
  });
  createEffect3(() => {
    const onResize = getDebounce("resize");
    globalThis.addEventListener("resize", onResize);
    onCleanup9(() => globalThis.removeEventListener("resize", onResize));
    whenEffect(element, (element2) => {
      const observer = new ResizeObserver2(onResize);
      observer.observe(element2);
      onCleanup9(() => observer.disconnect());
    });
  });
  return {
    setElement: (source) => {
      if (!source || source === element()) return;
      setElement(source);
      forceRefresh();
    },
    bounds,
    forceRefresh
  };
}
function findScrollContainers(element) {
  const result = [];
  if (!element || element === document.body) return result;
  const { overflow, overflowX, overflowY } = globalThis.getComputedStyle(element);
  if ([overflow, overflowX, overflowY].some((prop) => prop === "auto" || prop === "scroll"))
    result.push(element);
  return [...result, ...findScrollContainers(element.parentElement)];
}
var keys = ["x", "y", "top", "bottom", "left", "right", "width", "height"];
var areBoundsEqual = (a, b) => keys.every((key) => a[key] === b[key]);

// ../src/create-three.tsx
function createThree(canvas, props) {
  const canvasProps = defaultProps(props, {
    frameloop: "always"
  });
  const frameListeners = {
    before: {
      map: /* @__PURE__ */ new Map(),
      priorities: []
      // Keep this sorted
    },
    after: {
      map: /* @__PURE__ */ new Map(),
      priorities: []
    }
  };
  const addFrameListener = (callback, options) => {
    return createRoot((dispose) => {
      createRenderEffect4(() => {
        const {
          stage = "before",
          priority = 0
        } = options ?? {};
        const listeners = frameListeners[stage];
        let array = listeners.map.get(priority);
        if (!array) {
          array = [];
          listeners.map.set(priority, array);
          const index = binarySearch(listeners.priorities, priority);
          listeners.priorities.splice(index, 0, priority);
        }
        array.push(callback);
        onCleanup10(() => {
          removeElementFromArray(array, callback);
          if (array.length === 0) {
            listeners.map.delete(priority);
            listeners.priorities.splice(listeners.priorities.indexOf(priority), 1);
          }
        });
      });
      return dispose;
    });
  };
  function updateFrameListeners(stage, delta, frame) {
    for (const priority of frameListeners[stage].priorities) {
      const callbacks = frameListeners[stage].map.get(priority);
      for (const callback of callbacks) {
        callback(context, delta, frame);
      }
    }
  }
  let pendingRenderRequest;
  const isPresenting = () => !!context.gl?.xr?.isPresenting;
  function render(timestamp, frame) {
    if (!context.gl || rendererReady.state !== "ready") {
      return;
    }
    if (props.frameloop === "never") {
      context.clock.elapsedTime = timestamp;
    }
    pendingRenderRequest = void 0;
    const delta = context.clock.getDelta();
    updateFrameListeners("before", delta, frame);
    context.gl.render(context.scene, context.camera);
    updateFrameListeners("after", delta, frame);
  }
  function requestRender() {
    if (isPresenting()) return;
    if (pendingRenderRequest) return;
    pendingRenderRequest = requestAnimationFrame(render);
  }
  onCleanup10(() => pendingRenderRequest && cancelAnimationFrame(pendingRenderRequest));
  const cameraIsInstance = createMemo4(() => props.camera instanceof Camera2);
  const orthographicFlag = createMemo4(() => !!props.orthographic);
  const sceneIsInstance = createMemo4(() => props.scene instanceof Scene);
  const raycasterIsInstance = createMemo4(() => props.raycaster instanceof Raycaster2);
  const glKind = createMemo4(() => {
    const _propsGl = props.gl;
    if (typeof _propsGl === "function") return "factory";
    if (isRenderer(_propsGl)) return "instance";
    return "default";
  });
  const WEBGL_CONSTRUCTOR_KEYS = ["alpha", "antialias", "depth", "failIfMajorPerformanceCaveat", "logarithmicDepthBuffer", "powerPreference", "precision", "premultipliedAlpha", "preserveDrawingBuffer", "reversedDepthBuffer", "stencil"];
  const camera = createMemo4(() => {
    if (cameraIsInstance()) {
      return meta(props.camera, {
        get props() {
          return props.camera || {};
        }
      });
    }
    return meta(orthographicFlag() ? new OrthographicCamera2() : new PerspectiveCamera(), {
      get props() {
        return props.camera || {};
      }
    });
  });
  const cameraStack = new Stack("camera");
  const scene = createMemo4(() => {
    if (sceneIsInstance()) {
      return meta(props.scene, {
        get props() {
          return props.scene || {};
        }
      });
    }
    return meta(new Scene(), {
      get props() {
        return props.scene || {};
      }
    });
  });
  const raycaster = createMemo4(() => {
    if (raycasterIsInstance()) {
      return meta(props.raycaster, {
        get props() {
          return props.raycaster || {};
        }
      });
    }
    return meta(new CursorRaycaster(), {
      get props() {
        return props.raycaster || {};
      }
    });
  });
  const raycasterStack = new Stack("raycaster");
  let ownsCurrentRenderer = false;
  let initialConstructorArgs = {};
  const gl = createMemo4((previous) => {
    if (previous && ownsCurrentRenderer) {
      const old = previous;
      old.dispose?.();
      if ("forceContextLoss" in old) old.forceContextLoss();
    }
    const kind = glKind();
    let _gl;
    if (kind === "factory") {
      _gl = props.gl(canvas);
      ownsCurrentRenderer = false;
    } else if (kind === "instance") {
      _gl = props.gl;
      ownsCurrentRenderer = false;
    } else {
      const flat = untrack4(() => props.gl ?? {});
      const constructorArgs = {};
      for (const key of WEBGL_CONSTRUCTOR_KEYS) {
        if (key in flat) constructorArgs[key] = flat[key];
      }
      initialConstructorArgs = constructorArgs;
      _gl = new WebGLRenderer({
        alpha: true,
        ...constructorArgs,
        canvas
      });
      ownsCurrentRenderer = true;
    }
    return meta(_gl, {
      get props() {
        return props.gl || {};
      }
    });
  });
  const [rendererReady] = createResource2(() => gl(), (renderer) => {
    const init = getPendingInit(renderer);
    if (!init) return true;
    const rect = canvas.getBoundingClientRect();
    const ratio = globalThis.devicePixelRatio || 1;
    if (rect.width > 0 && rect.height > 0) {
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
    }
    return init().then(() => true);
  });
  const measure = useMeasure();
  measure.setElement(canvas);
  const defaultTarget = new Vector34();
  const viewport = createMemo4(() => getCurrentViewport(camera(), defaultTarget, measure.bounds()));
  const clock = new Clock();
  clock.start();
  const initializedPlugins = /* @__PURE__ */ new Set();
  const context = {
    get bounds() {
      return measure.bounds();
    },
    owner: getOwner4(),
    initializePlugin(token, fn) {
      if (initializedPlugins.has(token)) return;
      initializedPlugins.add(token);
      fn();
    },
    canvas,
    clock,
    eventRegistry: [],
    get dpr() {
      return this.gl.getPixelRatio?.() ?? 1;
    },
    props,
    render,
    requestRender,
    get viewport() {
      return viewport();
    },
    // elements
    get camera() {
      return cameraStack.peek() ?? camera();
    },
    setCamera(camera2) {
      return cameraStack.push(camera2);
    },
    get scene() {
      return scene();
    },
    get raycaster() {
      return raycasterStack.peek() || raycaster();
    },
    setRaycaster(raycaster2) {
      return raycasterStack.push(raycaster2);
    },
    get gl() {
      return gl();
    }
  };
  withMultiContexts(() => {
    createRenderEffect4(() => {
      if (props.frameloop === "never") {
        context.clock.stop();
        context.clock.elapsedTime = 0;
      } else {
        context.clock.start();
      }
    });
    createRenderEffect4(() => {
      if (cameraStack.peek()) return;
      if (!props.camera || props.camera instanceof Camera2) return;
      useProps(camera, props.camera);
      camera().updateMatrixWorld(true);
    });
    createRenderEffect4(() => {
      if (!props.scene || props.scene instanceof Scene) return;
      useProps(scene, props.scene);
    });
    createRenderEffect4(() => {
      if (!props.raycaster || props.raycaster instanceof Raycaster2) return;
      useProps(raycaster, props.raycaster);
    });
    createRenderEffect4(() => {
      createRenderEffect4(() => {
        const shadowMap = gl().shadowMap;
        if (!shadowMap) return;
        const oldEnabled = shadowMap.enabled;
        const oldType = shadowMap.type;
        shadowMap.enabled = !!props.shadows;
        if (typeof props.shadows === "boolean") {
          shadowMap.type = PCFSoftShadowMap;
        } else if (typeof props.shadows === "string") {
          const types = {
            basic: BasicShadowMap,
            percentage: PCFShadowMap,
            soft: PCFSoftShadowMap,
            variance: VSMShadowMap
          };
          shadowMap.type = types[props.shadows] ?? PCFSoftShadowMap;
        } else if (typeof props.shadows === "object") {
          Object.assign(shadowMap, props.shadows);
        }
        if (isWebGLShadowMap(shadowMap) && (oldEnabled !== shadowMap.enabled || oldType !== shadowMap.type)) {
          shadowMap.needsUpdate = true;
        }
      });
      const _gl = gl();
      if ("outputColorSpace" in _gl) {
        useProps(gl, {
          get outputColorSpace() {
            return props.linear ? LinearSRGBColorSpace : SRGBColorSpace;
          }
        });
      }
      if ("toneMapping" in _gl) {
        useProps(gl, {
          get toneMapping() {
            return props.flat ? NoToneMapping : ACESFilmicToneMapping;
          }
        });
      }
      const _propsGl = props.gl;
      if (_propsGl && typeof _propsGl !== "function" && !isRenderer(_propsGl)) {
        useProps(gl, _propsGl);
      }
      let warnedCtorKeys = false;
      createEffect4(() => {
        if (warnedCtorKeys) return;
        const flat = props.gl ?? {};
        for (const key of WEBGL_CONSTRUCTOR_KEYS) {
          if (key in flat && flat[key] !== initialConstructorArgs[key]) {
            console.warn(`solid-three: <Canvas gl={...}> received a new value for "${String(key)}", but WebGLRenderer constructor args are immutable for the canvas's lifetime. To swap renderer config at runtime, unmount and remount <Canvas>.`);
            warnedCtorKeys = true;
            return;
          }
        }
      });
    });
  }, [[threeContext, context]]);
  let pendingLoopRequest;
  function loop(value) {
    if (isPresenting()) {
      pendingLoopRequest = void 0;
      return;
    }
    pendingLoopRequest = requestAnimationFrame(loop);
    context.render(value);
  }
  createRenderEffect4(() => {
    if (canvasProps.frameloop === "always") {
      pendingLoopRequest = requestAnimationFrame(loop);
    }
    onCleanup10(() => pendingLoopRequest && cancelAnimationFrame(pendingLoopRequest));
  });
  createRenderEffect4(() => {
    const _gl = gl();
    const xr = _gl.xr;
    if (!xr || typeof xr.addEventListener !== "function") return;
    const resume = () => {
      if (canvasProps.frameloop === "always") {
        if (!pendingLoopRequest) pendingLoopRequest = requestAnimationFrame(loop);
      } else if (canvasProps.frameloop === "demand") {
        requestRender();
      }
    };
    xr.addEventListener("sessionend", resume);
    onCleanup10(() => xr.removeEventListener("sessionend", resume));
  });
  const {
    addEventListener
  } = createEvents(context);
  const c = children2(() => _$createComponent(eventContext.Provider, {
    value: addEventListener,
    get children() {
      return _$createComponent(frameContext.Provider, {
        value: addFrameListener,
        get children() {
          return _$createComponent(threeContext.Provider, {
            value: context,
            get children() {
              return canvasProps.children;
            }
          });
        }
      });
    }
  }));
  useSceneGraph(context.scene, {
    get children() {
      return c();
    }
  });
  withMultiContexts(() => useRef(props, context), [[threeContext, context], [frameContext, addFrameListener]]);
  return mergeProps4(context, {
    addFrameListener
  });
}

// ../src/canvas.tsx
var _tmpl$ = /* @__PURE__ */ _$template(`<div style=position:relative;width:100%;height:100%;overflow:hidden;contain:strict;display:flex><canvas>`);
function Canvas(props) {
  let canvas;
  let container;
  onMount2(() => {
    if (!canvas || !container) return;
    const context = createThree(canvas, props);
    createResizeObserver(container, function onResize() {
      const {
        width,
        height
      } = container.getBoundingClientRect();
      context.gl.setSize(width, height);
      context.gl.setPixelRatio?.(globalThis.devicePixelRatio);
      if (context.camera instanceof OrthographicCamera3) {
        context.camera.left = width / -2;
        context.camera.right = width / 2;
        context.camera.top = height / 2;
        context.camera.bottom = height / -2;
      } else {
        context.camera.aspect = width / height;
      }
      context.camera.updateProjectionMatrix();
      if (!context.gl?.xr?.isPresenting) context.render(performance.now());
    });
  });
  return (() => {
    var _el$ = _tmpl$(), _el$2 = _el$.firstChild;
    var _ref$ = container;
    typeof _ref$ === "function" ? _$use(_ref$, _el$) : container = _el$;
    var _ref$2 = canvas;
    typeof _ref$2 === "function" ? _$use(_ref$2, _el$2) : canvas = _el$2;
    _$effect((_p$) => {
      var _v$ = {
        ...props.style
      }, _v$2 = props.class;
      _p$.e = _$style(_el$, _v$, _p$.e);
      _v$2 !== _p$.t && _$className(_el$, _p$.t = _v$2);
      return _p$;
    }, {
      e: void 0,
      t: void 0
    });
    return _el$;
  })();
}

// ../src/components.tsx
import { createComponent as _$createComponent2 } from "solid-js/web";
import { memo as _$memo } from "solid-js/web";
import { Show, createMemo as createMemo5, mergeProps as mergeProps5, splitProps as splitProps2 } from "solid-js";
function Portal(props) {
  const context = useThree();
  const element = createMemo5(() => {
    return props.element ? hasMeta(props.element) ? props.element : meta(props.element, {
      props: {}
    }) : context.scene;
  });
  useProps(element, {
    get onUpdate() {
      return props.onUpdate;
    },
    get children() {
      return () => withContext(
        () => props.children,
        // @ts-expect-error TODO: fix type-error
        threeContext,
        mergeProps5(context, {
          get scene() {
            return element();
          }
        })
      );
    }
  });
  return null;
}
function Entity(props) {
  const [config, rest] = splitProps2(props, ["from", "args", "plugins"]);
  const instance = createMemo5(() => {
    const from = config.from;
    if (!from) return void 0;
    props.key;
    return meta(isConstructor(from) ? autodispose(new from(...config.args ?? [])) : from, {
      props
    });
  });
  useProps(instance, rest, void 0, config.plugins ? [...config.plugins] : []);
  return instance;
}
function Resource(props) {
  const [options, config, rest] = splitProps2(props, ["base", "cache", "onBeforeLoad", "onLoad"], ["loader", "url", "children"]);
  const resource = useLoader(() => config.loader, () => config.url, options);
  const tagged = createMemo5(() => {
    const value = resource();
    if (!value || typeof value !== "object") return value;
    return hasMeta(value) ? value : meta(value, {
      props
    });
  });
  useProps(tagged, rest);
  return _$createComponent2(Show, {
    get when() {
      return _$memo(() => "children" in config)() && tagged();
    },
    get fallback() {
      return tagged();
    },
    children: (value) => props.children?.(value)
  });
}

// ../src/create-t.tsx
import { createMemo as createMemo6 } from "solid-js";
function createT(catalogue, plugins) {
  const pluginList = plugins ? [...plugins] : [];
  const cache = /* @__PURE__ */ new Map();
  return new Proxy({}, {
    get: (_, name) => {
      if (!cache.has(name)) {
        const constructor = catalogue[name];
        if (!constructor) return void 0;
        cache.set(name, createEntity(constructor, pluginList));
      }
      return cache.get(name);
    }
  });
}
function createEntity(Constructor, plugins = []) {
  return (props) => {
    const memo = createMemo6(() => {
      props.key;
      try {
        return meta(autodispose(new Constructor(...props.args ?? [])), {
          props
        });
      } catch (e) {
        console.error(e);
        throw new Error("");
      }
    });
    useProps(memo, props, void 0, plugins);
    return memo;
  };
}

// ../src/create-xr.tsx
import { createComponent as _$createComponent3 } from "solid-js/web";
import { createContext as createContext3, createRenderEffect as createRenderEffect5, createSignal as createSignal5, onCleanup as onCleanup11, useContext as useContext3 } from "solid-js";
var xrContext = createContext3();
function useXR() {
  const state = useContext3(xrContext);
  if (!state) {
    throw new Error("S3: useXR must be used within <xr.Provider> (from createXR())");
  }
  return state;
}
function createXR() {
  const [context, setContext] = createSignal5();
  const [presenting, setPresenting] = createSignal5(false);
  const [session, setSession] = createSignal5();
  createRenderEffect5(() => {
    const ctx = context();
    const gl = ctx ? ctx.gl : void 0;
    const xr = gl?.xr;
    if (!gl || !xr || typeof xr.addEventListener !== "function") return;
    const onStart = () => setPresenting(true);
    const onEnd = () => {
      setPresenting(false);
      setSession(void 0);
      gl.setAnimationLoop(null);
      gl.xr.enabled = false;
    };
    xr.addEventListener("sessionstart", onStart);
    xr.addEventListener("sessionend", onEnd);
    onCleanup11(() => {
      xr.removeEventListener("sessionstart", onStart);
      xr.removeEventListener("sessionend", onEnd);
    });
  });
  function connect(value) {
    setContext(value);
    return () => setContext(void 0);
  }
  function requestSession(mode, init) {
    if (!navigator.xr) {
      throw new Error("S3: WebXR unavailable (navigator.xr is undefined)");
    }
    return navigator.xr.requestSession(mode, init);
  }
  async function enter(arg, init) {
    const ctx = context();
    if (!ctx) {
      throw new Error("S3: createXR().enter() called before <Canvas ref={xr.connect}> connected");
    }
    const gl = ctx.gl;
    if (!gl.xr) {
      throw new Error("S3: the active renderer has no xr manager");
    }
    const xrSession = typeof arg === "string" ? await requestSession(arg, init) : arg;
    gl.setAnimationLoop(ctx.render);
    gl.xr.enabled = true;
    await gl.xr.setSession(xrSession);
    setSession(xrSession);
    return xrSession;
  }
  async function exit() {
    await session()?.end();
  }
  function isSupported(mode) {
    return navigator.xr?.isSessionSupported(mode) ?? Promise.resolve(false);
  }
  const state = {
    isPresenting: presenting,
    session,
    exit
  };
  function Provider(props) {
    return _$createComponent3(xrContext.Provider, {
      value: state,
      get children() {
        return props.children;
      }
    });
  }
  return {
    connect,
    enter,
    exit,
    isSupported,
    isPresenting: presenting,
    session,
    Provider
  };
}

// ../src/types.ts
var types_exports = {};
export {
  $S3C,
  Canvas,
  CenterRaycaster,
  ControllerRaycaster,
  CursorRaycaster,
  Entity,
  Pointer,
  Portal,
  Resource,
  types_exports as S3,
  autodispose,
  createEntity,
  createT,
  createThreeEvent,
  createXR,
  getMeta,
  hasMeta,
  hasPointerCapture,
  load,
  meta,
  plugin,
  useFrame,
  useLoader,
  useProps,
  useThree,
  useXR
};
