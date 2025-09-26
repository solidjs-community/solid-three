<p>
  <img width="100%" src="https://assets.solidjs.com/banner?type=solid-three&background=tiles&project=%20" alt="solid-three">
</p>

# solid-three

`solid-three` is a port of [react-three-fiber](https://github.com/pmndrs/react-three-fiber) to [solid-js](https://www.solidjs.com/). It allows you to declaratively construct a [three.js](https://threejs.org/) scene, with reactive primitives, just as you would construct a DOM tree in `solid-js`.

- **Declarative `three.js` Components**: Utilize `three.js` objects as JSX components.
- **Reactive Prop Updates**: Properties of 3D objects update reactively, promoting efficient re-renders.
- **Integrated Animation Loop**: `useFrame` hook allows for easy animations.
- **Comprehensive Event System**: Enhanced event handling with support for `three.js` pointer and mouse events.
- **Extensible and Customizable**: Easily extendable with additional `three.js` entities or custom behaviors.
- **Optimized for `solid-js`**: Leverages `solid-js`' fine-grained reactivity for optimal performance.

## Table of Contents

1. [Installation](#installation)
2. [Basic Usage](#basic-usage)
3. [Components](#components)
   - [Canvas](#canvas)
   - [T](#t)
   - [Entity](#entity)
   - [Portal](#portal)
4. [Hooks](#hooks)
   - [useThree](#usethree)
   - [useFrame](#useframe)
   - [useLoader](#useloader)
   - [useProps](#useprops)
5. [Utilities](#utilities)
   - [autodispose](#autodispose)
6. [Event Handling](#event-handling)
   - [Controlling Raycasting with pointerEvents](#controlling-raycasting-with-pointerevents)
   - [Supported Events](#supported-events)
   - [Event Object](#event-object)
   - [Event Propagation](#event-propagation)
   - [Missed Events](#missed-events)
   - [Hover Events](#hover-events)
7. [TypeScript Support](#typescript-support)
8. [Performance Optimization](#performance-optimization)
9. [Differences from React-Three-Fiber](#differences-from-react-three-fiber)
10. [Contributing](#contributing)
11. [License](#license)

## Installation

```bash
npm install solid-three three
```

```bash
pnpm install solid-three three
```

```bash
yarn add solid-three three
```

Ensure that `solid-js` is installed in your environment, as it is a peer dependency of `solid-three`.

## Basic Usage

Here's a simple example to get you started:

```tsx
import { Component, createSignal } from "solid-js"
import { Canvas, Entity, useFrame } from "solid-three"
import * as THREE from "three"

const Box = () => {
  let mesh: THREE.Mesh | undefined
  const [hovered, setHovered] = createSignal(false)

  useFrame(() => (mesh!.rotation.y += 0.01))

  return (
    <Entity
      from={THREE.Mesh}
      ref={mesh}
      onPointerEnter={e => setHovered(true)}
      onPointerLeave={e => setHovered(false)}
    >
      <Entity from={THREE.BoxGeometry} />
      <Entity from={THREE.MeshStandardMaterial} args={[{ color: hovered() ? "green" : "red" }]} />
    </Entity>
  )
}

const App: Component = () => {
  return (
    <Canvas defaultCamera={{ position: [0, 0, 5] }}>
      <Entity from={THREE.AmbientLight} args={[0.5]} />
      <Entity from={THREE.PointLight} position={[10, 10, 10]} />
      <Box />
    </Canvas>
  )
}
```

Alternatively, using the `createT()` pattern:

```tsx
import { Component, createSignal } from "solid-js"
import { Canvas, createT, useFrame } from "solid-three"
import * as THREE from "three"

// Create the T namespace
const T = createT(THREE)

const Box = () => {
  let mesh: THREE.Mesh | undefined
  const [hovered, setHovered] = createSignal(false)

  useFrame(() => (mesh!.rotation.y += 0.01))

  return (
    <T.Mesh
      ref={mesh}
      onPointerEnter={e => setHovered(true)}
      onPointerLeave={e => setHovered(false)}
    >
      <T.BoxGeometry />
      <T.MeshStandardMaterial color={hovered() ? "green" : "red"} />
    </T.Mesh>
  )
}

const App: Component = () => {
  return (
    <Canvas defaultCamera={{ position: [0, 0, 5] }}>
      <T.AmbientLight intensity={0.5} />
      <T.PointLight position={[10, 10, 10]} />
      <Box />
    </Canvas>
  )
}
```

**Choosing between `Entity` and `T`:**

- **Use `Entity`**: When building libraries, working with dynamic object types, or when you want to avoid creating a namespace
- **Use `T`**: When building applications where you want the convenience of pre-typed components and better autocomplete

## Components

### Canvas

The `Canvas` component initializes the `three.js` rendering context and acts as the root for your 3D scene. All `<T/>` and `<Entity/>` components must be children of this Canvas.

**Props:**

- **camera** (`Partial<PerspectiveCamera | OrthographicCamera> | Camera`): Configures the camera used in the scene. Can be partial props for a camera or an existing Camera instance.
- **fallback** (`JSX.Element`): Element to render while the main content is loading asynchronously.
- **gl** (`Partial<WebGLRenderer> | ((canvas: HTMLCanvasElement) => WebGLRenderer) | WebGLRenderer`): Defines options for the WebGLRenderer, a function returning a customized renderer, or an existing renderer instance.
- **scene** (`Partial<Scene> | Scene`): Provides custom settings for the Scene instance or an existing Scene.
- **raycaster** (`Partial<Raycaster> | Raycaster`): Configures the Raycaster for mouse and pointer events.
- **shadows** (`boolean | "basic" | "percentage" | "soft" | "variance" | WebGLRenderer["shadowMap"]`): Enables and configures shadows in the scene with various shadow mapping techniques.
- **orthographic** (`boolean`): Toggles between Orthographic and Perspective camera.
- **linear** (`boolean`): Toggles linear interpolation for texture filtering.
- **flat** (`boolean`): Toggles flat interpolation for texture filtering.
- **frameloop** (`"never" | "demand" | "always"`): Controls the rendering loop's operation mode:
  - `"always"`: Renders continuously on every frame
  - `"demand"`: Renders only when explicitly requested
  - `"never"`: Disables automatic rendering
- **style** (`JSX.CSSProperties`): Custom CSS styles for the canvas container.
- **Event handlers**: All event handlers are supported on the Canvas component, allowing you to handle events that bubble through the entire scene (e.g., `onClick`, `onPointerMove`, `onClickMissed`, etc.)

Example with all props:

```tsx
<Canvas
  camera={{ position: [0, 0, 5], fov: 75 }}
  fallback={<div>Loading...</div>}
  gl={{ antialias: true, alpha: true }}
  scene={{ fog: new Fog(0xffffff, 1, 100) }}
  raycaster={{ params: { Line: { threshold: 0.1 } } }}
  shadows="soft"
  orthographic={false}
  linear={false}
  flat={false}
  frameloop="always"
  style={{ background: "black" }}
  onClick={e => console.log("Canvas clicked")}
  onClickMissed={e => console.log("Clicked empty space")}
  onPointerMove={e => console.log("Pointer moved on canvas")}
>
  {/* Your 3D scene */}
</Canvas>
```

### T

The `T` namespace contains components that wrap `three.js` objects, allowing you to insert them into your scene declaratively. You create the namespace using the `createT()` factory function:

```tsx
import { createT } from "solid-three"
import * as THREE from "three"

// Create T namespace with all three.js objects
const T = createT(THREE)

// Now you can use T components
<T.Mesh>
  <T.BoxGeometry args={[1, 1, 1]} />
  <T.MeshBasicMaterial color="hotpink" />
</T.Mesh>
```

You can also create a namespace with specific objects for tree-shaking purposes:

```tsx
import { createT } from "solid-three"
import { Mesh, BoxGeometry, MeshBasicMaterial } from "three"

// Create T namespace with only specific objects
const T = createT({ Mesh, BoxGeometry, MeshBasicMaterial })
```

**Usage Patterns:**

- **In Applications**: Create a single `T` and export it for use throughout your app
- **In Libraries**: create multiple `T` to allow for treeshaking or use [`<Entity/>`](#entity) instead
- **Multiple Ts**: Create multiple T instances for lazy loading different parts of three.js

#### Advanced Prop Patterns

`solid-three` supports advanced prop attachment patterns for precise control:

```tsx
const AdvancedProps = () => {
  return (
    <T.Mesh>
      <T.BoxGeometry />
      <T.MeshStandardMaterial
        // Direct property setting
        color="red"
        // Nested property access with dot notation
        material-color="blue"
        // Sub-property access with hyphens
        position-x={2}
        rotation-y={Math.PI / 4}
        scale-z={0.5}
        // Deep nested properties
        material-emissive-intensity={0.5}
      />
    </T.Mesh>
  )
}
```

**Supported patterns:**

- **Direct props**: `color="red"` → `object.color = "red"`
- **Hyphen notation**: `position-x={1}` → `object.position.x = 1`
- **Deep nesting**: `material-emissive-intensity={0.5}` → `object.material.emissive.intensity = 0.5`

These patterns automatically trigger `needsUpdate` flags on materials and geometries when necessary.

### Entity

The `Entity` component provides an alternative way to create three.js objects without needing to pre-create a T namespace. This is particularly useful in libraries or when working with dynamic object types:

```tsx
import { Entity } from "solid-three"
import { Mesh, BoxGeometry, MeshBasicMaterial } from "three"

function Constructor() {
  return (
    // Pass constructor with optional arguments
    <Entity from={Mesh}>
      <Entity from={BoxGeometry} />
      <Entity from={MeshBasicMaterial} args={[{ color: "orange" }]} />
    </Entity>
  )
}

function Instance() {
  // Pass instance
  const mesh = new Mesh()
  return <Entity from={mesh} position={[0, 0, 0]} />
}
```

**Props:**

- **from** (`Constructor | Instance`): Either a three.js constructor (class) or an existing instance
- **args** (`ConstructorParameters`): Arguments to pass to the constructor when using a class
- All other props supported by the three.js object

#### Manual disposal of instance-entities

When passing an instance to `<Entity from={...}/>` disposal need to be handled manually. This can be done via the [`autodispose`-utility](#autodispose):

```tsx
import { Entity, autodispose } from "solid-three"
import { BoxGeometry, SphereGeometry } from "three"

function Wrong(props: { shape: "box" | "sphere" }) {
  const box = new BoxGeometry()
  const sphere = new SphereGeometry()
  return (
    <Show when={props.shape === "box"} fallback={<Entity from={sphere} />}>
      <Entity from={box} />
    </Show>
  )
}

function Good(props: { shape: "box" | "sphere" }) {
  const box = autodispose(new BoxGeometry())
  const sphere = autodispose(new SphereGeometry())
  return (
    <Show when={props.shape === "box"} fallback={<Entity from={sphere} />}>
      <Entity from={box} />
    </Show>
  )
}
```

### Portal

The `Portal` component allows you to place children outside the regular scene graph while maintaining reactive updates. This is useful for rendering objects into different scenes or bypassing the normal parent-child relationships.

**Props:**

- **element** (`Object3D | S3.Instance<Object3D>`): Optional `three.js` object to render into. If not provided, renders into the root scene.
- **children** (`JSX.Element`): Elements to render in the portal.

Example:

```tsx
import { Portal } from "solid-three"

// Create a separate scene for UI elements
const uiScene = new Scene()

const App = () => {
  return (
    <Canvas>
      <T.Mesh>
        <T.BoxGeometry />
        <T.MeshBasicMaterial color="blue" />
      </T.Mesh>

      {/* Render these objects into a different scene */}
      <Portal element={uiScene}>
        <T.Mesh position={[2, 0, 0]}>
          <T.SphereGeometry />
          <T.MeshBasicMaterial color="red" />
        </T.Mesh>
      </Portal>
    </Canvas>
  )
}
```

## Hooks

### useThree

Provides access to the `three.js` context, including the renderer, scene, camera, and more. This hook can be used with or without a selector function for optimized access to specific properties.

**Returns:**

- **camera** (`Camera`): The active camera (PerspectiveCamera or OrthographicCamera).
- **gl** (`WebGLRenderer`): The WebGL renderer instance.
- **scene** (`Scene`): The root scene.
- **raycaster** (`Raycaster`): The raycaster used for pointer events.
- **canvas** (`HTMLCanvasElement`): The canvas DOM element.
- **clock** (`Clock`): The `three.js` clock for timing.
- **pointer** (`Vector2`): Current normalized pointer coordinates (-1 to 1).
- **setPointer** (`Setter<Vector2>`): Function to update pointer coordinates.
- **render** (`(delta: number) => void`): Function to manually trigger a render.
- **requestRender** (`() => void`): Function to request a render on the next frame.
- **xr** (`{ connect: () => void; disconnect: () => void }`): WebXR connection management.
- **bounds** (`Measure`): Reactive canvas bounds measurement.

**Usage:**

```tsx
// Get the entire context
const context = useThree()
const { gl, scene, camera } = context

// Use with a selector for specific properties (returns Accessor)
const camera = useThree(state => state.camera)
const cameraValue = camera() // Must call the accessor

// Multiple values with selector
const values = useThree(state => ({ gl: state.gl, scene: state.scene }))
const { gl, scene } = values() // Must call the accessor

// Example: Manual rendering control
const context = useThree()
const handleUpdate = () => {
  // Perform updates
  context.requestRender() // Request a render for the next frame
}
```

### useFrame

Registers a callback that will be called before every frame is rendered, useful for animations and updates.

**Signature:**

```tsx
useFrame((context: Context, delta: number, frame?: XRFrame) => void)
```

**Parameters:**

- **context** - The three.js context object (same as `useThree()`)
- **delta** - Time elapsed since last frame in seconds
- **frame** - Optional XRFrame for WebXR sessions

```tsx
const RotatingMesh = () => {
  useFrame((context, delta) => {
    const { scene } = context
    scene.children[0].rotation.y += delta * Math.PI
  })

  return (
    <T.Mesh>
      <T.BoxGeometry />
      <T.MeshStandardMaterial color="purple" />
    </T.Mesh>
  )
}
```

### useLoader

Manages asynchronous resource loading, such as textures or models, and integrates with `solid-js`' reactivity system. This hook can be used with Solid's `<Suspense>` to handle loading states.

**Signature:**

```tsx
function useLoader<TLoader, TArgs>(
  Constructor: new (...args: any[]) => TLoader,
  args: Accessor<TArgs>, // Must be an Accessor
  setup?: (loader: TLoader) => void, // Optional setup function
)
```

#### Single Texture

```tsx
import { createSignal } from "solid-js"
import { Canvas, useLoader } from "solid-three"
import { TextureLoader } from "three"

const TexturedSphere = () => {
  const [url, setUrl] = createSignal("path/to/texture.jpg")
  const texture = useLoader(TextureLoader, url, loader => (loader.crossOrigin = "anonymous"))

  return (
    <T.Mesh onClick={() => setUrl("path/to/other/texture.jpg")}>
      <T.SphereGeometry args={[5, 32, 32]} />
      <T.MeshBasicMaterial map={texture()} />
    </T.Mesh>
  )
}

export const App = () => {
  return (
    <Canvas>
      <TexturedSphere />
    </Canvas>
  )
}
```

### Multiple textures

```tsx
import { Canvas, useLoader } from "solid-three"
import { TextureLoader } from "three"

const TexturedPlanes = () => {
  const textures = useLoader(TextureLoader, () => ["/textures/wood.jpg", "/textures/metal.jpg"])

  return (
    <For each={textures()}>
      {(texture, index) => (
        <T.Mesh position={[index() * 6, 0, 0]}>
          <T.PlaneGeometry args={[5, 5]} />
          <T.MeshBasicMaterial map={texture} />
        </T.Mesh>
      )}
    </For>
  )
}

export const App = () => {
  return (
    <Canvas>
      <TexturedPlanes />
    </Canvas>
  )
}
```

### useProps

The `useProps` hook manages and applies `solid-three` props to THREE.js objects. It sets up reactive effects to ensure properties are correctly applied and updated, manages children attachment, and handles automatic disposal.

**Signature:**

```tsx
function useProps<T extends object>(object: Accessor<T>, props: any): void
```

**Parameters:**

- **object** (`Accessor<T>`): An accessor function that returns the target THREE.js object
- **props** (`any`): Object containing props to apply (including `ref`, `children`, and THREE.js properties)

**Usage:**

This hook is primarily used internally by `solid-three` components, but can be useful when creating custom components or integrating existing THREE.js objects:

```tsx
import { createSignal } from "solid-js"
import { useProps } from "solid-three"
import { Mesh, BoxGeometry, MeshBasicMaterial } from "three"

const CustomMesh = props => {
  const mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial())

  // Apply solid-three props reactively to the mesh
  useProps(() => mesh, props)

  return mesh // Return the THREE.js object for use in JSX
}

// Usage
;<CustomMesh position={[1, 2, 3]} rotation={[0, Math.PI, 0]} color="red" />
```

**What it handles:**

- **Reactive prop updates**: Automatically applies prop changes to the THREE.js object
- **Ref assignment**: Handles both function refs and object refs
- **Children management**: Attaches/detaches child objects from the scene graph
- **Automatic disposal**: Cleans up the object when the component unmounts
- **Special props**: Processes `onUpdate` callbacks after prop applications

**Advanced usage:**

```tsx
import { createMemo, createRenderEffect, onCleanup } from "solid-js"
import { useProps, useThree } from "solid-three"
import { Mesh, SphereGeometry, MeshStandardMaterial } from "three"

export function OrbitControls(props: S3.Props<typeof ThreeOrbitControls>) {
  const three = useThree()
  const controls = createMemo<ThreeOrbitControls>(previous => {
    const controls = autodispose(new ThreeOrbitControls(three.camera))
    controls.connect(three.gl.domElement)
    return controls
  })

  useFrame(() => controls().update())

  useProps(controls, rest)

  return null!
}
```

## Utilities

### autodispose

The `autodispose` utility ensures that three.js objects are properly disposed on cleanup.

```tsx
import { autodispose } from "solid-three"
import { BoxGeometry, MeshBasicMaterial } from "three"

function Component() {
  // Any object wrapped with autodispose will be disposed when Component's owner cleans up
  const geometry = autodispose(new BoxGeometry())
  const material = autodispose(new MeshBasicMaterial({ color: "red" }))
}
```

**Use cases:**

- Creating reusable instances that should be disposed with the component
- Working with conditional rendering where objects need cleanup
- Managing resources in reactive contexts

```tsx
import { Show, createSignal } from "solid-js"
import { Entity, autodispose } from "solid-three"
import { Mesh, BoxGeometry, MeshBasicMaterial } from "three"

function ConditionalMesh() {
  const [visible, setVisible] = createSignal(true)

  // These will be disposed when ConditionalMesh unmounts
  const geometry = autodispose(new BoxGeometry())
  const material = autodispose(new MeshBasicMaterial())

  return (
    <Show when={visible()}>
      <Entity from={new Mesh(geometry, material)} />
    </Show>
  )
}
```

## Event Handling

`solid-three` provides a comprehensive event system that integrates `three.js` pointer and mouse events with `solid-js`' reactivity. Events are automatically handled through raycasting and support stopping propagation.

### Controlling Raycasting with raycastable

The `raycastable` prop controls whether an Object3D can be targeted by raycasting:

- **raycastable** (`boolean`): When set to `false`, the object will not be hit by rays, but can still receive events through propagation from its descendants. Default is `true`.

```tsx
<T.Mesh name="parent" raycastable={false} onClick={() => console.log("Child clicked!")}>
  <T.Mesh name="child" />
</T.Mesh>
```

### Supported Events

- `onClick` - Fired when clicking on an object
- `onClickMissed` - Fired when a click doesn't hit any objects with onClick handlers
- `onContextMenu` - Fired when right-clicking on an object
- `onContextMenuMissed` - Fired when a right-click doesn't hit any objects with onContextMenu handlers
- `onDoubleClick` - Fired when double-clicking on an object
- `onDoubleClickMissed` - Fired when a double-click doesn't hit any objects with onDoubleClick handlers
- `onMouseDown` - Fired when mouse button is pressed
- `onMouseEnter` - Fired when mouse enters object
- `onMouseLeave` - Fired when mouse leaves object
- `onMouseMove` - Fired when mouse moves over object
- `onMouseUp` - Fired when mouse button is released
- `onPointerDown` - Fired when pointer is pressed
- `onPointerEnter` - Fired when pointer enters object
- `onPointerLeave` - Fired when pointer leaves object
- `onPointerMove` - Fired when pointer moves
- `onPointerUp` - Fired when pointer is released
- `onWheel` - Fired on mouse wheel events

### Event Object

Event handlers receive an event object with the following properties:

```tsx
interface Event<T> {
  // Original DOM event
  nativeEvent: T

  // Event control (only for stoppable events)
  stopped?: boolean // Whether propagation has been stopped
  stopPropagation?: () => void // Stop event propagation
}
```

### Event Propagation

solid-three implements a dual propagation system for events:

1. **Raycast Propagation (3D Space)**

   - When you click, solid-three casts a ray from the camera through your mouse position into the 3D scene. This ray may intersect multiple objects.
   - Events are processed for each intersected object in order from closest to farthest from the camera.
   - If an object calls `stopPropagation()`, objects further along the ray won't receive the event.

2. **Tree Propagation (Scene Graph)**
   - After an object handles an event, it bubbles up through the scene graph hierarchy (child → parent).
   - If `stopPropagation()` is called, parent objects won't receive the event.
   - If no object calls `stopPropagation()`, the event finally bubbles to the `<Canvas/>` component itself. This allows you to handle events at the canvas level, such as detecting clicks on empty space.

```tsx
// Example showing all propagation types
<Canvas onClick={() => console.log("4. Canvas clicked (canvas propagation)")}>
  <T.Group onClick={() => console.log("3. Group clicked (tree propagation)")}>
    <T.Mesh
      position={[0, 0, 0]}
      onClick={() => console.log("2. Back mesh clicked (raycast propagation)")}
    >
      <T.BoxGeometry />
      <T.MeshBasicMaterial color="blue" />
    </T.Mesh>

    <T.Mesh
      position={[0, 0, 2]} // In front
      onClick={e => {
        console.log("1. Front mesh clicked (raycast propagation)")
        e.stopPropagation() // Stops ALL propagation (raycast, tree, and canvas)
      }}
    >
      <T.BoxGeometry />
      <T.MeshBasicMaterial color="red" />
    </T.Mesh>
  </T.Group>
</Canvas>
```

In this example, clicking the overlapping area would normally trigger events in this order:

1. Front mesh (closest to camera)
2. Back mesh (further from camera)
3. Group (parent in tree)
4. Canvas (root container)

But with `stopPropagation()`, only the front mesh receives the event.

### Stoppable vs Non-Stoppable Events

Not all events in solid-three can be stopped with `stopPropagation()`. This design choice aligns with DOM behavior and ensures predictable event handling.

**Non-stoppable events:**

- `onClickMissed`, `onDoubleClickMissed`, `onContextMenuMissed` - [Missed events](#missed-events) always fire for all registered handlers
- `onMouseEnter`, `onPointerEnter` - Enter events always fire to maintain consistent hover state ([hover events](#hover-events-entermoveleave))
- `onMouseLeave`, `onPointerLeave` - Leave events always fire to ensure proper cleanup ([hover events](#hover-events-entermoveleave))

**Stoppable events:**

- All other events (`onClick`, `onMouseMove`, `onPointerMove`, `onMouseDown`, etc.) can be stopped with `stopPropagation()`

For non-stoppable events, the event object only contains the `nativeEvent` property:

```tsx
// Stoppable event
onClick={e => {
  e.stopPropagation() // ✓ Works
  console.log(e.stopped) // ✓ Available
}}

// Non-stoppable event
onClickMissed={e => {
  e.stopPropagation() // ✗ Property doesn't exist
  console.log(e.nativeEvent) // ✓ Available
}}
```

**Example:**

```tsx
const InteractiveCube = () => {
  const [hovered, setHovered] = createSignal(false)
  const [clicked, setClicked] = createSignal(0)

  return (
    <T.Mesh
      onClick={e => {
        e.stopPropagation()
        setClicked(c => c + 1)
        console.log("Native event:", e.nativeEvent)
      }}
      onPointerMove={() => setHovered(true)}
      onWheel={e => console.log("Wheel delta:", e.nativeEvent.deltaY)}
    >
      <T.BoxGeometry />
      <T.MeshStandardMaterial
        color={hovered() ? "hotpink" : "orange"}
        emissive={clicked() > 0 ? "red" : "black"}
      />
    </T.Mesh>
  )
}
```

### Missed Events

The "missed" events (`onClickMissed`, `onDoubleClickMissed`, `onContextMenuMissed`) fire when an object has registered a missed event handler and the click/interaction didn't hit the object or any of its descendants.

**When missed events fire:**

1. **Click outside object**: The click didn't intersect with the object or any of its descendants
2. **Blocked by stopPropagation**: Another object called `stopPropagation()` preventing the event from reaching this object

```tsx
const MissedEventExample = () => {
  return (
    <>
      {/* Example 1: Click outside the mesh */}
      <T.Mesh onClickMissed={() => console.log("Missed - clicked outside this mesh")}>
        <T.BoxGeometry />
        <T.MeshBasicMaterial color="blue" />
      </T.Mesh>

      {/* Example 2: Blocked by tree propagation */}
      <T.Group onClickMissed={() => console.log("Group missed - child stopped propagation")}>
        <T.Mesh
          onClick={e => {
            e.stopPropagation()
            console.log("Child clicked")
          }}
        >
          <T.BoxGeometry />
          <T.MeshBasicMaterial color="red" />
        </T.Mesh>
      </T.Group>

      {/* Example 3: Blocked by raycast propagation */}
      <T.Mesh
        position={[0, 0, 0]}
        onClickMissed={() => console.log("Back mesh missed - front mesh blocked it")}
      >
        <T.BoxGeometry />
        <T.MeshBasicMaterial color="green" />
      </T.Mesh>
      <T.Mesh
        position={[0, 0, 2]} // In front
        onClick={e => {
          e.stopPropagation()
          console.log("Front mesh clicked")
        }}
      >
        <T.BoxGeometry />
        <T.MeshBasicMaterial color="yellow" />
      </T.Mesh>
    </>
  )
}
```

This is useful for:

- Deselecting objects when clicking outside them
- Creating UI layers where front objects can block interactions with objects behind
- Handling complex interaction patterns where parent containers need to know when their children intercepted events

### Hover Events (Enter/Move/Leave)

solid-three handles hover events (`onMouseEnter`, `onMouseMove`, `onMouseLeave`, `onPointerEnter`, `onPointerMove`, `onPointerLeave`) with a specific scheduling approach:

**Event Scheduling:**

1. **Enter Phase**: All enter events are processed first for newly hovered objects
2. **Move Phase**: All move events are processed for objects under the pointer
3. **Leave Phase**: All leave events are processed for objects no longer under the pointer

This ensures predictable event ordering and aligns with standard DOM behavior where enter/leave events have clear boundaries.

<details>
<summary>Differences from react-three-fiber</summary>

solid-three's hover event handling differs from react-three-fiber in several key ways:

**1. Event Order:**

- **solid-three**: Processes all enter events first, then move events, then leave events (DOM-like behavior)
- **react-three-fiber**: Intertwines enter/move/leave events as they occur during traversal

**2. Propagation:**

- **solid-three**:
  - Move events can be stopped with `stopPropagation()`
  - Enter/Leave events always fire and cannot be stopped (DOM-like behavior)
- **react-three-fiber**: All hover events can be stopped with `stopPropagation()`

**3. Parent-Child Behavior:**

- **solid-three**: When moving from child to parent, only the child receives a leave event (DOM-like behavior)
- **react-three-fiber**: When moving from child to parent, the parent receives both leave and immediate re-enter events
</details>

## Performance Optimization

`solid-three` provides several mechanisms to optimize rendering performance:

### Automatic Resource Disposal

`solid-three` automatically manages memory by disposing of three.js objects when components are removed from the scene:

```tsx
const AutoDisposedGeometry = () => {
  return (
    <T.Mesh>
      {/* Geometry and material are automatically disposed when component unmounts */}
      <T.BoxGeometry />
      <T.MeshBasicMaterial color="red" />
    </T.Mesh>
  )
}
```

**Automatic disposal includes:**

- Geometries (`dispose()` method called on unmount)
- Materials (`dispose()` method called on unmount)
- Textures (disposed when no longer referenced)
- Other three.js objects with a `dispose()` method

**Manual disposal:** If you need custom disposal behavior, you can handle cleanup manually:

```tsx
const ManualDisposal = () => {
  let geometry: BoxGeometry

  const dispose = () => {
    geometry?.dispose()
  }

  return <T.BoxGeometry ref={geometry} />
}
```

or use the [`autodispose()`-utility](#autodispose)

### Frame Loop Control

Use the `frameloop` prop on Canvas to control when rendering occurs:

```tsx
// Only render on demand (when scene changes)
<Canvas frameloop="demand">
  {/* Your scene */}
</Canvas>

// Never render automatically (manual control)
<Canvas frameloop="never">
  {/* Your scene */}
</Canvas>

// Always render (default)
<Canvas frameloop="always">
  {/* Your scene */}
</Canvas>
```

**Demand Rendering System:**

When `frameloop="demand"` is set, `solid-three` automatically requests renders when:

- Component props change
- Scene graph structure changes (components added/removed)
- Object transformations are updated (position, rotation, scale)
- Material properties change

This provides optimal performance by only rendering when necessary while maintaining reactivity.

### Manual Rendering

When using `frameloop="demand"` or `"never"`, you can manually trigger renders:

```tsx
const ManualRender = () => {
  const { render, requestRender } = useThree()

  // Immediate render
  const forceRender = () => render()

  // Request render on next frame
  const updateScene = () => {
    // Make changes
    requestRender()
  }

  return <T.Mesh onClick={updateScene} />
}
```

### Conditional Frame Updates

Use conditional logic within `useFrame` for optimized updates:

```tsx
const OptimizedAnimation = () => {
  let mesh: Mesh
  const [isAnimating, setIsAnimating] = createSignal(true)

  useFrame((context, delta) => {
    if (!isAnimating()) return // Skip if not animating

    mesh.rotation.y += delta
  })

  return <T.Mesh ref={mesh} onClick={() => setIsAnimating(!isAnimating())} />
}
```

### Color Space Handling

`solid-three` automatically handles color space conversions and legacy property aliasing:

```tsx
const ColorHandling = () => {
  return (
    <T.Mesh>
      <T.PlaneGeometry />
      {/* Color values are automatically converted */}
      <T.MeshBasicMaterial
        color="red" // String colors converted to THREE.Color
        emissive={0xff0000} // Hex colors handled automatically
        opacity={0.5} // Numeric values passed through
      />
    </T.Mesh>
  )
}
```

**Automatic conversions:**

- String colors (`"red"`, `"#ff0000"`) → `THREE.Color`
- Hex numbers (`0xff0000`) → `THREE.Color`
- Array colors (`[1, 0, 0]`) → `THREE.Color`
- Texture `encoding` property aliased to `colorSpace` for three.js r152+ compatibility

### Texture Optimization

Configure texture filtering for better performance:

```tsx
// Disable expensive texture filtering
<Canvas linear={false} flat>
  {/* Your scene */}
</Canvas>
```

### Instance Reuse

Reuse `three.js` objects across components:

```tsx
// Create shared geometry
const sharedGeometry = new BoxGeometry(1, 1, 1)

const OptimizedBoxes = () => {
  return (
    <>
      {Array.from({ length: 100 }, (_, i) => (
        <Primitive object={new Mesh(sharedGeometry)} position={[i * 2, 0, 0]} />
      ))}
    </>
  )
}
```

### Automatic Disposal

`solid-three` automatically disposes of `three.js` objects when components unmount, preventing memory leaks. However, for shared resources, manage disposal manually:

```tsx
const SharedResource = () => {
  const texture = useLoader(TextureLoader, "/texture.jpg")

  onCleanup(() => {
    // Manual cleanup for shared resources if needed
    texture()?.dispose()
  })

  return <T.MeshBasicMaterial map={texture()} />
}
```

## Differences from React-Three-Fiber

While `solid-three` is heavily inspired by– and initially shared a lot of code with– react-three-fiber, there are currently several key differences:

- **No `performance` Prop**: The `Canvas` component does not support a `performance` prop as optimization is handled differently in `solid-js`.
- **Simplified Event Objects**: The event object provided to event handlers is more minimalistic.
- **Minimal `useThree` Hook**: Returns a more concise context object, focusing on essential properties.
- **Missed Events**: Implements `onClickMissed`, `onDoubleClickMissed`, and `onContextMenuMissed` for handling events on empty space or stopped propagation.
- **TODO**:
  - **No Pointer Capture**: Pointer events do not support pointer capture management.

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTION.md) for details on how to get started.

## License

`solid-three` is [MIT licensed](LICENSE).
