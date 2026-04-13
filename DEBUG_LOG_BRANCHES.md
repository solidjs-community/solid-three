# Branch Documentation

This document catalogs all branches (if/else, switch/case, loops) in the codebase, indicating which ones have debug logging.

---

## src/create-events.ts

### raycast() - Lines 113-140
**Debug:** ✅ `debugEvents` (line 137-139)

| Branch | Line | Debug |
|--------|------|-------|
| `if ("update" in context.raycaster)` | 113 | ❌ |
| `for (const object of stack)` | 122 | ❌ |
| `if (visitedSet.has(object))` | 123 | ❌ |
| `if (meta && meta.props.raycastable !== false)` | 129 | ❌ |

### createMissableEventRegistry() - Lines 155-232
**Debug:** ❌

| Branch | Line | Debug |
|--------|------|-------|
| `if (registry.array.length === 0) return` | 162 | ❌ |
| `for (const intersection of intersections)` | 174 | ❌ |
| `while (node && !stoppableEvent.stopped && !visitedObjects.has(node))` | 181 | ❌ |
| `if (!stoppableEvent.stopped)` | 194 | ❌ |
| `for (const remainingObject of missedObjects)` | 202 | ❌ |
| `for (const { object } of intersections)` | 209 | ❌ |
| `for (const object of missedObjects)` | 222 | ❌ |
| `if (visitedObjects.size > 0)` | 226 | ❌ |

### createHoverEventRegistry() - Lines 251-362
**Debug:** ❌

| Branch | Line | Debug |
|--------|------|-------|
| `if (hoveredCanvas === false)` | 285 | ❌ |
| `for (const intersection of intersections)` | 264, 297 | ❌ |
| `while (current && !enterSet.has(current))` | 271 | ❌ |
| `if (!hoveredSet.has(current))` | 273 | ❌ |
| `while (current && !moveSet.has(current))` | 305 | ❌ |
| `if (meta)` | 308 | ❌ |
| `if (moveEvent.stopped)` | 314 | ❌ |
| `if (!moveEvent.stopped)` | 323 | ❌ |
| `for (const object of leaveSet.values())` | 338 | ❌ |
| `for (const object of hoveredSet)` | 352 | ❌ |

### createDefaultEventRegistry() - Lines 378-421
**Debug:** ❌

| Branch | Line | Debug |
|--------|------|-------|
| `for (const intersection of intersections)` | 391 | ❌ |
| `while (node && !event.stopped)` | 399 | ❌ |
| `if (!event.stopped)` | 408 | ❌ |

### addEventListener() - Lines 461-497
**Debug:** ❌

| Branch | Line | Debug |
|--------|------|-------|
| `switch (type)` | 462 | ❌ |
| `case "onClick":` | 464 | ❌ |
| `case "onClickMissed":` | 465 | ❌ |
| `case "onContextMenu":` | 467 | ❌ |
| `case "onContextMenuMissed":` | 468 | ❌ |
| `case "onDoubleClick":` | 470 | ❌ |
| `case "onDoubleClickMissed":` | 471 | ❌ |
| `case "onMouseEnter":` | 475 | ❌ |
| `case "onMouseLeave":` | 476 | ❌ |
| `case "onMouseMove":` | 477 | ❌ |
| `case "onPointerEnter":` | 479 | ❌ |
| `case "onPointerLeave":` | 480 | ❌ |
| `case "onPointerMove":` | 481 | ❌ |
| `case "onMouseDown":` | 485 | ❌ |
| `case "onMouseUp":` | 487 | ❌ |
| `case "onPointerDown":` | 489 | ❌ |
| `case "onPointerUp":` | 491 | ❌ |
| `case "onWheel":` | 493 | ❌ |

---

## src/props.ts

### applySceneGraph() - Lines 37-122
**Debug:** ✅ `debugAttach` (line 59, 82, 112, 117, 121)

| Branch | Line | Debug |
|--------|------|-------|
| `if (parentMeta)` | 42 | ❌ |
| `if (childMeta)` | 49 | ❌ |
| `if (typeof attachProp === "function")` | 58 | ✅ |
| `if (!attachProp)` | 67 | ❌ |
| `if (child instanceof Material)` | 68 | ❌ |
| `else if (child instanceof BufferGeometry)` | 71 | ❌ |
| `else if (child instanceof Fog)` | 74 | ❌ |
| `if (attachProp)` | 81 | ✅ |
| `while ((property = path.shift()))` | 93 | ❌ |
| `if (path.length === 0)` | 94 | ❌ |
| `else` | 100 | ❌ |
| `if (child instanceof Object3D && parent instanceof Object3D)` | 110 | ❌ |
| `if (!parent.children.includes(child))` | 111 | ✅ |

### useSceneGraph() - Lines 141-206
**Debug:** ✅ `debugSceneGraph` (line 158, 189)

| Branch | Line | Debug |
|--------|------|-------|
| `if (!parent \|\| !child)` | 157 | ✅ |
| `if (!childAccessors?.length) return` | 169 | ❌ |
| `if (!(parent instanceof Object3D)) return` | 171 | ❌ |
| `for (const a of childAccessors)` | 173 | ❌ |
| `if (c instanceof Object3D) managedChildren.push(c)` | 175 | ❌ |
| `if (!managedChildren.length) return` | 177 | ❌ |
| `if (indices.length < 2) return` | 180 | ❌ |
| `for (let i = 1; i < indices.length; i++)` | 182 | ❌ |
| `if (indices[i] <= indices[i - 1])` | 183 | ❌ |
| `if (ordered) return` | 188 | ✅ |
| `for (const child of managedChildren)` | 195 | ❌ |
| `if (currentPos === -1) continue` | 197 | ❌ |
| `if (currentPos !== insertPos)` | 198 | ❌ |

### applyProp() - Lines 236-346
**Debug:** ✅ `debugApplyProp` (line 243, 250, 257, 276, 281, 294, 304, 307, 322, 327, 333)

| Branch | Line | Debug |
|--------|------|-------|
| `if (!source)` | 242 | ✅ |
| `if (value === undefined)` | 250 | ✅ |
| `if (type.indexOf("-") > -1)` | 255 | ✅ |
| `if (NEEDS_UPDATE.includes(type) && ((!source[type] && value) \|\| (source[type] && !value)))` | 262 | ❌ |
| `if (hasColorSpace(source))` | 269 | ❌ |
| `if (type === "encoding")` | 274 | ✅ |
| `else if (type === "outputEncoding")` | 279 | ✅ |
| `if (isEventType(type))` | 293 | ✅ |
| `if (target?.copy && target?.constructor === value?.constructor && !isWritable(source, type))` | 303 | ✅ |
| `else if (target?.set && Array.isArray(value))` | 306 | ✅ |
| `else if (target?.set && typeof value !== "object")` | 317 | ❌ |
| `if (!isColor && target.setScalar && typeof value === "number")` | 321 | ✅ |
| `else if (value !== undefined)` | 326 | ✅ |
| `else` | 332 | ✅ |

### useProps() - Lines 364-478
**Debug:** ✅ `debugUseProps` (line 371, 382, 385, 403, 451, 457)

| Branch | Line | Debug |
|--------|------|-------|
| `if (!options?.skipSceneGraph) useSceneGraph(accessor, props)` | 376 | ❌ |
| `if (!object)` | 381 | ✅ |
| `if (ref instanceof Function) ref(object)` | 391 | ❌ |
| `if (isEventType(key) && object instanceof Object3D && hasMeta(object))` | 402 | ✅ |
| `if (value instanceof Texture && value.format === RGBAFormat && value.type === UnsignedByteType)` | 438 | ❌ |
| `if (!result) return` | 448 | ❌ |
| `if (hasColorSpace(texture) && hasColorSpace(gl))` | 450 | ✅ |
| `else` | 456 | ✅ |

---

## src/hooks.ts

### useFrame() - Lines 43-51
**Debug:** ✅ `debugUseFrame` (line 46, 49)

| Branch | Line | Debug |
|--------|------|-------|
| `if (!addFrameListener)` | 45 | ✅ |

### useThree() - Lines 70-90
**Debug:** ✅ `debugUseThree` (line 75, 80)

| Branch | Line | Debug |
|--------|------|-------|
| `if (!getOwner())` | 74 | ✅ |
| `if (!store)` | 79 | ✅ |
| `if (callback) return () => callback(store)` | 88 | ❌ |

### resolveUrls() - Lines 139-150
**Debug:** ❌

| Branch | Line | Debug |
|--------|------|-------|
| `if (Array.isArray(url))` | 140 | ❌ |
| `else if (isRecord(url))` | 142 | ❌ |
| `else if (typeof url === "string")` | 146 | ❌ |

### useLoader() - Lines 195-284
**Debug:** ✅ `debugUseLoader` (line 204)

| Branch | Line | Debug |
|--------|------|-------|
| `if (!loader)` | 214 | ❌ |
| `if (isRecord(input))` | 234 | ❌ |
| `if (cachedPromise)` | 243 | ❌ |
| `if (config.cache === true)` | 257 | ❌ |
| `if (!useLoader.cache)` | 258 | ❌ |
| `if (config.cache)` | 265 | ❌ |

---

## src/create-three.tsx

Scoped debuggers: `debug` (createThree), `debugFrame` (frameListeners), `debugXR` (XR), `debugRender` (render), `debugContext` (context memos), `debugEffects` (effects).

### Frame Listeners
**Debug:** ✅ `debugFrame`

| Branch | Debug |
|--------|-------|
| `if (!array)` (first-ever priority bucket) | ✅ `registered { first: true }` |
| `else` (existing bucket) | ✅ `registered` |
| `if (array.length === 0)` (bucket emptied on cleanup) | ✅ `empty` |

### XR Handling
**Debug:** ✅ `debugXR`

| Branch | Debug |
|--------|-------|
| `if ((canvasProps.frameloop as string) === "never")` (skip XR frame) | ✅ `frame skipped` |
| XR frame render | ✅ `frame` |
| `handleSessionChange` | ✅ `session` |
| `xr.connect` | ✅ `connect` |
| `xr.disconnect` | ✅ `disconnect` |

### Render
**Debug:** ✅ `debugRender`

| Branch | Debug |
|--------|-------|
| `if (!context.gl)` | ✅ `skipped { reason: "no gl" }` |
| `if (props.frameloop === "never")` (clock override) | ✅ `clock override` |
| Render tick proper | ✅ `tick` |
| `if (pendingRenderRequest)` (coalesced) | ✅ `queued { coalesced: true }` |
| `else` (new RAF) | ✅ `queued { coalesced: false }` |

### Context Memos
**Debug:** ✅ `debugContext`

| Branch | Debug |
|--------|-------|
| `props.defaultCamera instanceof Camera` | ✅ `camera { source: "custom" }` |
| `props.orthographic` | ✅ `camera { source: "new OrthographicCamera" }` |
| else | ✅ `camera { source: "new PerspectiveCamera" }` |
| `props.scene instanceof Scene` | ✅ `scene { source: "custom" }` |
| else | ✅ `scene { source: "new Scene" }` |
| `props.defaultRaycaster instanceof Raycaster` | ✅ `raycaster { source: "custom" }` |
| else | ✅ `raycaster { source: "new CursorRaycaster" }` |
| `props.gl instanceof WebGLRenderer` | ✅ `gl { source: "custom" }` |
| `typeof props.gl === "function"` | ✅ `gl { source: "factory" }` |
| else | ✅ `gl { source: "default" }` |

### Effects
**Debug:** ✅ `debugEffects`

| Branch | Debug |
|--------|-------|
| `if (frameloop === "never")` clock stop | ✅ `clock { action: "stop" }` |
| else clock start | ✅ `clock { action: "start" }` |
| Camera: `if (peek)` skip | ✅ `camera { action: "skip", reason: "stack-peek" }` |
| Camera: `if (!dc \|\| dc instanceof Camera)` skip | ✅ `camera { action: "skip", reason: "no-default\|instance" }` |
| Camera apply | ✅ `camera { action: "apply" }` |
| Scene: `if (!scene_ \|\| scene_ instanceof Scene)` skip | ✅ `scene { action: "skip" }` |
| Scene apply | ✅ `scene { action: "apply" }` |
| Raycaster: `if (!raycaster \|\| raycaster instanceof Raycaster)` skip | ✅ `raycaster { action: "skip" }` |
| Raycaster apply | ✅ `raycaster { action: "apply" }` |
| Shadow: `if (!_gl.shadowMap)` skip | ✅ `shadow { action: "skip" }` |
| Shadow: `if (changed)` update | ✅ `shadow { action: "changed" }` |
| XR connect: `if (renderer.xr)` | ✅ `xr connect { hasXR: true }` |
| XR connect: else | ✅ `xr connect { action: "skip" }` |
| `if (props.gl && !(props.gl instanceof WebGLRenderer))` user options | ✅ `gl { action: "apply", type: "user-options" }` |

### Render Loop
**Debug:** ✅ `debugRender`

| Branch | Debug |
|--------|-------|
| `if (frameloop === "always")` | ✅ `loop { action: "start" }` |
| else | ✅ `loop { action: "idle" }` |

---

## src/utils.ts

### isRecord() - Lines 32-34
**Debug:** ❌

| Branch | Line | Debug |
|--------|------|-------|
| `return !Array.isArray(value) && typeof value === "object"` | 33 | ❌ |

### isClassInstance() - Lines 36-44
**Debug:** ❌

| Branch | Line | Debug |
|--------|------|-------|
| `return obj != null && typeof obj === "object" && !Array.isArray(obj) && obj.constructor !== Object && Object.getPrototypeOf(obj) !== Object.prototype` | 37 | ❌ |

### autodispose() - Lines 57-62
**Debug:** ❌

| Branch | Line | Debug |
|--------|------|-------|
| `if (object.dispose)` | 58 | ❌ |

### meta() - Lines 78-85
**Debug:** ❌

| Branch | Line | Debug |
|--------|------|-------|
| `if (hasMeta(instance))` | 79 | ❌ |

### getMeta() - Lines 87-91
**Debug:** ❌

| Branch | Line | Debug |
|--------|------|-------|
| `return hasMeta(value) ? value[$S3C] : undefined` | 90 | ❌ |

### hasMeta() - Lines 93-95
**Debug:** ❌

| Branch | Line | Debug |
|--------|------|-------|
| `return typeof element === "object" && element && $S3C in element` | 94 | ❌ |

### awaitMapObject() - Lines 103-114
**Debug:** ❌

| Branch | Line | Debug |
|--------|------|-------|
| `for (const key in object)` | 110 | ❌ |

### bubbleUp() - Lines 129-138
**Debug:** ❌

| Branch | Line | Debug |
|--------|------|-------|
| `while (current)` | 134 | ❌ |
| `if ("parent" in current)` | 136 | ❌ |

### buildGraph() - Lines 151-160
**Debug:** ❌

| Branch | Line | Debug |
|--------|------|-------|
| `if (obj.name) data.nodes[obj.name] = obj` | 154 | ❌ |
| `if (obj.material && !(obj.material.name in data.materials))` | 155 | ❌ |

### hasColorSpace() - Lines 190-195
**Debug:** ❌

| Branch | Line | Debug |
|--------|------|-------|
| `"colorSpace" in object \|\| "outputColorSpace" in object` | 195 | ❌ |

### isConstructor() - Lines 203-205
**Debug:** ❌

| Branch | Line | Debug |
|--------|------|-------|
| `return typeof value === "function" && value.prototype !== undefined` | 204 | ❌ |

### removeElementFromArray() - Lines 213-217
**Debug:** ❌

| Branch | Line | Debug |
|--------|------|-------|
| `const index = array.indexOf(value)` | 214 | ❌ |
| `if (index !== -1) array.splice(index, 1)` | 215 | ❌ |

### resolve() - Lines 225-237
**Debug:** ❌

| Branch | Line | Debug |
|--------|------|-------|
| `if (isConstructor(child))` | 226 | ❌ |
| `if (typeof child === "function")` | 229 | ❌ |
| `if (recursive)` | 231 | ❌ |

### withContext() - Lines 270-289
**Debug:** ❌

| Branch | Line | Debug |
|--------|------|-------|
| `if (typeof memo === "function") memo()` | 287 | ❌ |

### withMultiContexts() - Lines 317-345
**Debug:** ❌

| Branch | Line | Debug |
|--------|------|-------|
| `if (index === 0) result = acc()` | 332 | ❌ |
| `if (typeof memo === "function") memo()` | 343 | ❌ |

### load() - Lines 362-372
**Debug:** ❌

| Branch | Line | Debug |
|--------|------|-------|
| `if (isRecord(input))` | 366 | ❌ |

### useRef() - Lines 380-392
**Debug:** ❌

| Branch | Line | Debug |
|--------|------|-------|
| `if (typeof props.ref === "function")` | 384 | ❌ |
| `else` | 387 | ❌ |

### whenMemo() - Lines 404-412
**Debug:** ❌

| Branch | Line | Debug |
|--------|------|-------|
| `const v = accessor()` | 409 | ❌ |
| `return v ? fn(v) : undefined` | 410 | ❌ |

### getCurrentViewport() - Lines 422-453
**Debug:** ❌

| Branch | Line | Debug |
|--------|------|-------|
| `if (isVector3(target))` | 429 | ❌ |
| `else` | 431 | ❌ |
| `if (isOrthographicCamera(_camera))` | 437 | ❌ |

### binarySearch() - Lines 456-471
**Debug:** ❌

| Branch | Line | Debug |
|--------|------|-------|
| `while (left < right)` | 460 | ❌ |
| `if (array[mid] < target)` | 463 | ❌ |
| `else` | 466 | ❌ |

### hasContextInChain() - Lines 522-529
**Debug:** ❌

| Branch | Line | Debug |
|--------|------|-------|
| `while (o)` | 524 | ❌ |
| `if (o._context && o._context[contextId] !== undefined) return true` | 525 | ❌ |

---

## src/data-structure/loader-cache.ts

### LoaderCache class
**Debug:** ✅ `console.error` / `console.warn`

| Branch | Line | Debug |
|--------|------|-------|
| `if (!registry)` (get) | 139 | ✅ console.error |
| `if (!force && !this.freeList.has(node.data))` | 91 | ✅ console.error |
| `if (!node)` (get) | 117 | ✅ console.error |
| `if (!node)` (delete) | 139 | ✅ console.error |
| `if (this.count === 0)` | 261 | ❌ |
| `if (!getOwner())` | 267 | ✅ console.warn |
| `if (this.count <= 0)` | 275 | ❌ |
| `if (this.data !== data && !force)` | 288 | ✅ console.error |

---

## src/utils/use-measure.ts

**Debug:** ✅ `debug` (line 157, 160)

| Branch | Line | Debug |
|--------|------|-------|
| `if (!ResizeObserver)` | 53 | ❌ |
| `if (debounce) return createDebounce(forceRefresh, debounce)` | 79 | ❌ |
| `if (!el) return` | 85 | ❌ |
| `if (el instanceof HTMLElement && config.offsetSize)` | 101 | ❌ |
| `if (!lastBounds \|\| !areBoundsEqual(lastBounds, bounds))` | 108 | ❌ |
| `if (!scroll) return` | 122 | ❌ |
| `if (!config.scroll \|\| !containers) return` | 132 | ❌ |
| `if (!el)` | 156 | ✅ |
| `if (!source \|\| source === element())` | 169 | ❌ |
| `if (!element \|\| element === document.body)` | 180 | ❌ |
| `if ([overflow, overflowX, overflowY].some(prop => prop === "auto" \|\| prop === "scroll"))` | 182 | ❌ |

---

## Summary

### Files with Debug Logging
- `create-events.ts` - ✅ Comprehensive (raycast, missable, hover, default, addEventListener)
- `constants.ts` - None (no branches)
- `create-t.tsx` - ✅ Comprehensive (createT, createEntity)
- `utils.ts` - Pure helpers — intentionally silent
- `props.ts` - ✅ Comprehensive (useSceneGraph, applySceneGraph, applyProp, useProps)
- `hooks.ts` - ✅ Comprehensive (useFrame, useThree, useLoader, resolveUrls)
- `canvas.tsx` - ✅ Comprehensive (Canvas mount + resize)
- `components.tsx` - ✅ Comprehensive (Portal, Entity, Resource)
- `create-three.tsx` - ✅ Comprehensive (6 scoped debuggers: createThree, frameListeners, XR, render, context, effects)
- `data-structure/loader-cache.ts` - ✅ `debugCache` for tracked/freed/updated + existing console.error/warn for hard errors
- `utils/use-measure.ts` - ✅ Comprehensive (observer, bounds, scroll, debounce, setElement)

### Debugger Naming Convention

All debuggers use `createDebug("file:subject", SHOULD_DEBUG)` where `subject` is the function/component/subsystem within the file. Files with multiple subjects split into scoped debuggers (e.g. `debugUseFrame`, `debugUseThree`, `debugUseLoader`).

### Logging Convention

- **No START/END** — log decisions and outcomes, not entry/exit.
- **Decision-as-data**: collapse sibling branches into one log with a variant field, e.g. `debug("attached", { via: "callback" | "prop" | "add" | "default:Material" })`.
- **Self-described stories**: each log reads as a standalone fact.
- **Omit empty payloads**: `debug("topic")` for no data, not `debug("topic", {})`.
- **Noisy branches silenced by design**: per-frame guards, per-prop non-matches, pure helper recursion. Documented per-file above.