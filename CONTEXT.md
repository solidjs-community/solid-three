# solid-three

solid-three is a SolidJS renderer for three.js: you declare a three.js scene with JSX components and reactive props, and solid-three creates, wires, and reactively updates the underlying three.js objects.

## Language

### The element model

**Element**:
Any three.js value solid-three manages — an `Object3D`, but also a `Material`, `BufferGeometry`, `Fog`, etc. Its precise type is `Meta<T>`, said aloud as an _augmented element_: a three.js value carrying solid-three metadata (props, parent, children) under the `$S3C` symbol.
_Avoid_: node

**Object**:
An **element** that is an `Object3D` — a scene-graph member with a transform that can be hit by a ray. Materials and geometries are elements but not objects. The events surface is object-only (`event.object`, `event.currentObject`, `raycastable`).
_Avoid_: node

**Instance**:
A pre-constructed three.js value passed to a component via `from={instance}`, as opposed to a constructor. Not a synonym for element.

### Declaring elements

**Entity**:
An _element-component_: a Solid component that, when rendered, creates and manages an **element**. `createEntity(Ctor)` builds one entity from a constructor; `<Entity from={…}>` is the namespace-free form. The entity is the declaration; the **element** is the runtime value it produces.

**Catalogue**:
The record of named three.js constructors handed to `createT` — `THREE`, or a slimmed `{ Mesh, BoxGeometry }`.
_Avoid_: namespace (that's the output)

**T namespace** (**T**):
The proxy `createT(catalogue)` returns; each access (`T.Mesh`) lazily yields the **Entity** for that constructor. `<T.Mesh>` and `<Entity from={Mesh}>` are equivalent declarations.

### Configuring elements

**args**:
The constructor arguments for an element's three.js value — `args={[w, h]}` → `new BoxGeometry(w, h)`. Unlike other props (live setters), changing `args` reconstructs the element.

**attach**:
How a _non-object_ **element** binds into its parent: a **slot** — a string property path, auto-detected as `material` / `geometry` / `fog` — or a function `(parent, self) => cleanup` for custom wiring. Objects don't attach.

**dashed path**:
A hyphenated prop key that writes a nested property — `position-x`, `material-emissiveMap`, `shadow-mapSize-width`.
_Avoid_: sub-property, hyphen notation

### Runtime

**Canvas**:
The root component. Sets up the **renderer**, scene, camera, and raycaster, and provides the **Context** to descendants.

**Context**:
The per-**Canvas** runtime state — the **renderer**, `scene`, `camera`, `raycaster`, `clock`, `eventRegistry`, `viewport`, `bounds`, and the render loop. Returned by `useThree`.
_Avoid_: confusing it with the Solid context (`threeContext`) that distributes it — they're distinct.

**Renderer**:
The three.js renderer instance (`WebGLRenderer` or `WebGPURenderer`). Named `gl` in code — the `Context.gl` field and the `Canvas` `gl` prop (which also accepts renderer params or a factory). An R3F inheritance, and a misnomer once `WebGPURenderer` is in play.
_Avoid_: gl (as the spoken concept)

**Frame callback**:
A function registered with `useFrame` to run each rendered frame, ordered by `priority` within a `before` / `after` stage.
_Avoid_: frame listener

### Plugins

**Plugin**:
An extension `(element) => props | undefined`, created by `plugin()`; it either matches an element (returns its plugin props) or doesn't (`undefined`).

**plugin()**:
The factory for a **Plugin**, with three **selector** forms: global, an `instanceof` list, or a type-guard.

**selector**:
The filter deciding which **elements** a **Plugin** matches — a constructor list or a type-guard.

**plugin prop**:
A prop a **Plugin** adds to (or **overrides** on) matching elements, backed by a setter function the plugin supplies under that key (set the prop → the setter runs).
_Avoid_: contributed method

**override** (plugin):
A **plugin prop** whose key matches a native prop replaces it — both in runtime dispatch and in the prop types (`Props<T, TPlugins>` omits the native key and substitutes the plugin prop's type). Lets a plugin reshape an existing prop, not just add new ones.

**Register**:
The `declare module` augmentation interface for narrowing types project-wide (today: the renderer).

**initializePlugin**:
A `Context` method that runs a plugin's one-time, per-`Context` setup once (e.g. an XR plugin wiring its controller source on first use).

### Events

**`event.object`**:
The closest hit — `event.intersections[0].object`. Stable for the whole dispatch; the 3D analogue of a DOM event's `target`.

**`event.currentObject`**:
The **object** whose handler is firing as the event bubbles the hit chain; cleared after dispatch. The 3D analogue of `currentTarget`.
_Avoid_: target / currentTarget for the 3D sense — those stay DOM-only, on `nativeEvent`

**Intersection** (intersections):
A raycast hit — three.js `Intersection` (`object`, `point`, `distance`, `face`, `uv`, `normal`). `event.intersections` is nearest-first; `event.intersection` is the nearest.

**Void event**:
A canvas-level handler — `onVoidClick`, `onVoidDoubleClick`, `onVoidContextMenu`, `onVoidWheel`, `onVoidPointerDown`, `onVoidPointerUp` — fired when a gesture runs no object-level handler for it, reaching the **backdrop** instead. Exclusive with the canvas-level positive handler (a click runs `onClick` or `onVoidClick`, never both); judged per gesture (a hover-only object doesn't suppress `onVoidClick`).
_Avoid_: missed (the inverted, per-object framing it replaces).

**Backdrop**:
The conceptual surface behind every object — a gesture no object handles "reaches the backdrop", where its **void event** fires. Not a real mesh; the name for the "no object handler ran" branch of dispatch.

**raycast propagation**:
The first dispatch phase — the handler fires on each hit **object** nearest-first along the ray.

**tree propagation**:
The second dispatch phase — after an object's handler runs, the event _bubbles_ up its ancestors, finally to the **Canvas**. `stopPropagation()` halts both phases.

### Pointer system & raycasting

**pointer source**:
Something that produces pointer input and dispatches it into the scene — the built-in screen/DOM source, or XR controllers added by the XR layer.

**pointer manager**:
A **pointer source**'s implementation — owns the source's listeners and routes each event to a **Pointer**. The built-in one is `DOMPointerManager` (the canvas).

**Pointer**:
The per-pointer state machine (one per `pointerId`, plus a primary) that raycasts the **eventRegistry** and dispatches/bubbles to handlers, tracking its own hover and capture state.

**eventRegistry**:
The set of **objects** carrying event handlers; what the pointer system raycasts.

**raycaster**:
Aims a ray and casts it against the **eventRegistry**. Variants differ by how they aim — a **screen raycaster** from a cursor in **NDC** (`CursorRaycaster` = mouse, `CenterRaycaster` = gaze), or a `ControllerRaycaster` from an XR controller's transform.

**NDC**:
Normalized device coordinates — the `[-1, 1]` cursor space a **screen raycaster** aims from.

**raycastable**:
A prop; `false` opts an **object** out of hit-testing while it still receives events that **bubble** from its children.

**pointer capture**:
Routing a pointer's later move/up exclusively to one captured **object**'s chain (still bubbling to the **Canvas**), even off-ray and off-canvas — the basis for drag. Started via `event.setPointerCapture({ object?, normal? })`; released on pointer up / cancel or `releasePointerCapture()`.

**drag plane**:
The plane a captured pointer reprojects the live ray onto each move (through the grab point), so `event.intersection.point` keeps tracking. Orientation defaults to the hit surface (or camera-facing); `setPointerCapture({ normal })` overrides it.

**`hasPointerCapture(object)`**:
A context-free reactive predicate — whether `object` currently holds a pointer capture — for declarative drag visuals. Distinct from the event's imperative `event.hasPointerCapture()`.

### Components & lifecycle

**Portal**:
Renders its children under a different parent (a given **object** / scene) instead of the enclosing one, without leaving the reactive tree.

**Resource**:
A declarative `useLoader` wrapper — loads a three.js resource (texture, model) from a loader + URL, then attaches it or hands it to a render callback.

**Viewport**:
The canvas size in world units at a reference distance (`width`, `height`, `factor`, `aspect`, `distance`) — distinct from the pixel size (`bounds`).

**disposal** (autodispose):
solid-three automatically calls three.js `.dispose()` on an **element** when it unmounts, freeing GPU memory; `autodispose` is the wrapper that arranges it.

**XR**:
WebXR (VR/AR) session management (`createXR` / `useXR`). _In flux_: being externalized into a `solid-three/xr` plugin, so treat its vocabulary as provisional.

## Relationships

- An **Entity** is a component that produces one **Element**
- `createEntity` builds one **Entity**; `createT` builds a **T namespace** of them, keyed by the **Catalogue**
- Every **Object** is an **Element**; not every element is an object (a **Material** or **BufferGeometry** is an element, not an object)
- An **Entity** wraps either a constructor or a pre-built **Instance** (via `from`)
- An **Object** joins its parent's scene graph (`.add()`); a non-object **Element** binds via **attach**
- A **Canvas** owns one **Context**, which owns one **renderer**
- A **Plugin** matches **elements** via its **selector** and contributes **plugin props**; a plugin prop **overrides** the native prop of the same name
- A dispatch runs **raycast propagation** then **tree propagation**; `stopPropagation()` halts both. `event.object` is `event.intersections[0].object`
- A **pointer source** drives one or more **Pointers**; each **Pointer** raycasts the **eventRegistry** with a **raycaster**, then dispatches via **raycast propagation** and **tree propagation**
- The active **camera** and **raycaster** are stack-based: setting one (via `Canvas` props or `useThree`) pushes an override that pops on cleanup, restoring the previous

## Example dialogue

> **Dev:** "When I write `<T.Mesh>`, is the mesh the **entity**?"
> **Maintainer:** "No — `T.Mesh` is the **entity** (an element-component). Render it and it produces the **element**: the augmented `Mesh`. Since a `Mesh` is an `Object3D`, that element is also an **object**."
>
> **Dev:** "And the `<T.MeshStandardMaterial>` inside it?"
> **Maintainer:** "Also an **element**, but _not_ an **object** — a material has no transform and can't be hit. It doesn't join the scene graph; it **attaches** into the mesh's `material` slot."
>
> **Dev:** "Inside `onPointerDown`, how do `event.object` and `event.currentObject` differ?"
> **Maintainer:** "`event.object` is the closest hit and stays put for the whole dispatch — like a DOM `target`. `event.currentObject` is whichever ancestor the event is **bubbling** through right now — like `currentTarget` — and it's cleared after dispatch. Call `setPointerCapture()` there and that object holds the pointer for the drag."

## Flagged ambiguities

- "node" / "element" / "object" / "instance" were used interchangeably for a managed three.js value — resolved: **element** = any managed value, **object** = an `Object3D` specifically, **instance** = a pre-built value passed via `from`; "node" is avoided.
- "catalogue" vs "namespace" — resolved: **catalogue** = the input record of constructors; **T namespace** = the proxy `createT` returns.
- "dashed path" vs "sub-property" vs "hyphen notation" — resolved: **dashed path**.
- "Context" is overloaded: the runtime **state object** vs the Solid context (`threeContext`) that carries it. Glossary "Context" = the state object.
- `gl` is overloaded: the **renderer** instance (`Context.gl`) and the renderer-config `Canvas` prop — and it's a misnomer for `WebGPURenderer`. Spoken concept is **renderer**; a rename of the field/prop to `renderer` is planned (own PR; keep `gl` as a deprecated alias for one release).
- "contributed method" → renamed to **plugin prop** (the function backing it is its setter); the impl term hid that it surfaces as a prop. Code/docs (`resolvePluginMethods`, `pluginMethods`, JSDoc) to follow in a cleanup.
- `event.element` was renamed to **`event.currentObject`**, with **`event.object`** added — the 3D senses use **object** / **currentObject**; `target` / `currentTarget` stay DOM-only (`nativeEvent`).
