<p>
  <img width="100%" src="https://assets.solidjs.com/banner?type=solid-three&background=tiles&project=%20" alt="solid-three">
</p>

# solid-three

`solid-three` is a port of [react-three-fiber](https://github.com/pmndrs/react-three-fiber) to [solid-js](https://www.solidjs.com/). It allows you to declaratively construct a [Three.js](https://threejs.org/) scene, with reactive primitives, just as you would construct a DOM tree in `solid-js`.

## Table of Contents

1. [Features](#features)
2. [Differences from React-Three-Fiber](#differences-from-react-three-fiber)
3. [Installation](#installation)
4. [Setup with extend()](#setup-with-extend)
5. [Basic Usage](#basic-usage)
6. [Components](#components)
   - [Canvas](#canvas)
   - [Primitive Components (`<T/>`)](#primitive-components-t)
   - [Portal](#portal)
   - [Primitive](#primitive)
7. [Hooks](#hooks)
   - [useThree](#usethree)
   - [useFrame](#useframe)
   - [useLoader](#useloader)
8. [Event Handling](#event-handling)
   - [Supported Events](#supported-events)
   - [Event Object](#event-object)
   - [Event Propagation](#event-propagation)
   - [Missed Events](#missed-events)
   - [Hover Events](#hover-events)
9. [TypeScript Support](#typescript-support)
10. [Performance Optimization](#performance-optimization)
11. [Testing](#testing)
12. [API Reference](#api-reference)
13. [Contributing](#contributing)
14. [License](#license)

## Features

- **Declarative `three.js` Components**: Utilize `three.js` objects as JSX components.
- **Reactive Prop Updates**: Properties of 3D objects update reactively, promoting efficient re-renders.
- **Integrated Animation Loop**: `useFrame` hook allows for easy animations.
- **Comprehensive Event System**: Enhanced event handling with support for `three.js` pointer and mouse events.
- **Extensible and Customizable**: Easily extendable with additional `three.js` entities or custom behaviors.
- **Optimized for `solid-js`**: Leverages `solid-js`' fine-grained reactivity for optimal performance.

## Differences from React-Three-Fiber

While `solid-three` is heavily inspired by– and initially shared a lot of code with– react-three-fiber, there are currently several key differences:

- **No `performance` Prop**: The `Canvas` component does not support a `performance` prop as optimization is handled differently in `solid-js`.
- **Simplified Event Objects**: The event object provided to event handlers is more minimalistic.
- **Minimal `useThree` Hook**: Returns a more concise context object, focusing on essential properties.
- **Missed Events**: Implements `onClickMissed`, `onDoubleClickMissed`, and `onContextMenuMissed` for handling events on empty space or stopped propagation.
- **TODO**:
  - **No Pointer Capture**: Pointer events do not support pointer capture management.

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

## Setup with `extend()`

Before using solid-three components, you must register THREE.js objects with the `extend()` function:

```tsx
import { extend } from "solid-three"
import * as THREE from "three"

// Register all THREE.js objects (required step)
extend(THREE)
```

This registration step is required and must be done before rendering any `<T.*>` components. You can also register specific objects, allowing for treeshaking:

```tsx
import { extend } from "solid-three"
import { Mesh, BoxGeometry, MeshBasicMaterial } from "three"

// Register only specific objects
extend({ Mesh, BoxGeometry, MeshBasicMaterial })
```

## Basic Usage

Here's a simple example to get you started:

```tsx
import { Component, createSignal } from "solid-js"
import { Canvas, T, extend, useFrame } from "solid-three"
import { Mesh } from "three"
import * as THREE from "three"

// Required: Register THREE.js objects before using them
extend(THREE)

const Box = () => {
  let mesh: Mesh | undefined
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
    <Canvas camera={{ position: [0, 0, 5] }}>
      <T.AmbientLight intensity={0.5} />
      <T.PointLight position={[10, 10, 10]} />
      <Box />
    </Canvas>
  )
}
```

## Components

### Canvas

The `Canvas` component initializes the `three.js` rendering context and acts as the root for your 3D scene. All `<T/>` components must be children of this Canvas.

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
>
  {/* Your 3D scene */}
</Canvas>
```

### Primitive Components (`<T/>`)

`<T/>` components are wrappers around `three.js` objects, allowing you to insert these objects into your scene declaratively. These components are created dynamically based on the `three.js` classes you've registered with `extend()`.

Example:

```tsx
<T.Mesh>
  <T.BoxGeometry args={[1, 1, 1]} />
  <T.MeshBasicMaterial color="hotpink" />
</T.Mesh>
```

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
- **Dot notation**: `material.color="blue"` → `object.material.color = "blue"`
- **Deep nesting**: `material-emissive-intensity={0.5}` → `object.material.emissive.intensity = 0.5`

These patterns automatically trigger `needsUpdate` flags on materials and geometries when necessary.

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

### Primitive

The `Primitive` component wraps existing `three.js` objects and allows them to be used as JSX components within `solid-three`. This is useful when you have pre-created `three.js` objects or when working with objects from external libraries.

**Props:**

- **object** (`T extends ThreeInstance`): The `three.js` object to wrap.
- **ref** (`T | ((value: T) => void)`): Optional ref to access the object.
- Any additional props supported by the `three.js` object.

Example:

```tsx
import { Primitive } from "solid-three"
import { Mesh, BoxGeometry, MeshBasicMaterial } from "three"

// Create `three.js` objects imperatively
const geometry = new BoxGeometry(1, 1, 1)
const material = new MeshBasicMaterial({ color: "orange" })
const mesh = new Mesh(geometry, material)

const App = () => {
  return (
    <Canvas>
      {/* Use the existing mesh in the declarative scene */}
      <Primitive object={mesh} position={[0, 0, 0]} onClick={() => console.log("Clicked!")} />
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

- **context** - The Three.js context object (same as `useThree()`)
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
import { Canvas, T, useLoader } from "solid-three"
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
import { Canvas, T, useLoader } from "solid-three"
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

## Event Handling

`solid-three` provides a comprehensive event system that integrates `three.js` pointer and mouse events with `solid-js`' reactivity. Events are automatically handled through raycasting and support stopping propagation.

### Supported Events

**Mouse Events:**

- `onClick` - Fired when clicking on an object
- `onClickMissed` - Fired when a click doesn't hit any objects with onClick handlers
- `onDoubleClick` - Fired when double-clicking on an object
- `onDoubleClickMissed` - Fired when a double-click doesn't hit any objects with onDoubleClick handlers
- `onContextMenu` - Fired when right-clicking on an object
- `onContextMenuMissed` - Fired when a right-click doesn't hit any objects with onContextMenu handlers
- `onMouseDown` - Fired when mouse button is pressed
- `onMouseUp` - Fired when mouse button is released
- `onMouseMove` - Fired when mouse moves over object
- `onMouseEnter` - Fired when mouse enters object
- `onMouseLeave` - Fired when mouse leaves object
- `onWheel` - Fired on mouse wheel events

**Pointer Events:**

- `onPointerDown` - Fired when pointer is pressed
- `onPointerUp` - Fired when pointer is released
- `onPointerMove` - Fired when pointer moves
- `onPointerEnter` - Fired when pointer enters object
- `onPointerLeave` - Fired when pointer leaves object

### Event Object

Event handlers receive an event object with the following properties:

```tsx
interface Event<T> {
  // Original DOM event
  nativeEvent: T

  // Event control
  stopped: boolean // Whether propagation has been stopped
  stopPropagation: () => void // Stop event propagation
}
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

### Event Propagation

solid-three implements a dual propagation system for events:

1. **Raycast Propagation (3D Space)**: When you click, solid-three casts a ray from the camera through your mouse position into the 3D scene. This ray may intersect multiple objects. Events are processed for each intersected object in order from closest to farthest from the camera. If an object calls `stopPropagation()`, objects further along the ray won't receive the event.

2. **Tree Propagation (Scene Graph)**: After an object handles an event, it bubbles up through the scene graph hierarchy (child → parent). This follows the three.js object tree structure. If `stopPropagation()` is called, parent objects won't receive the event.

```tsx
// Example showing both propagation types
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
      e.stopPropagation() // Stops BOTH raycast and tree propagation
    }}
  >
    <T.BoxGeometry />
    <T.MeshBasicMaterial color="red" />
  </T.Mesh>
</T.Group>
```

In this example, clicking the overlapping area would normally trigger events in this order:

1. Front mesh (closest to camera)
2. Back mesh (further from camera)
3. Group (parent in tree)

But with `stopPropagation()`, only the front mesh receives the event.

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

## TypeScript Support

`solid-three` provides comprehensive TypeScript support through the `S3` namespace, which contains all type definitions for working with `three.js` in a type-safe manner.

### Core Types

```tsx
import type { S3 } from "solid-three"

// Component types
type MeshComponent = S3.Component<Mesh>
type BoxProps = S3.ClassProps<BoxGeometry>

// Instance types - `three.js` objects augmented with solid-three metadata
type AugmentedMesh = S3.Instance<Mesh>

// Generic Three instance
type AnyInstance = S3.ThreeInstance

// Camera types
type Camera = S3.CameraType // PerspectiveCamera | OrthographicCamera
```

### Props Types

```tsx
// Get props type for a specific `three.js` class
type MeshProps = S3.Props<"Mesh">
type MaterialProps = S3.Props<"MeshStandardMaterial">

// Using in components
const MyMesh = (props: MeshProps) => {
  return <T.Mesh {...props} />
}
```

### Event Types

```tsx
// Event handler types
type ClickHandler = S3.EventHandlers["onClick"]
type PointerHandler = S3.EventHandlers["onPointerMove"]

// Event object type
const handleClick: ClickHandler = (event: S3.Event<MouseEvent>) => {
  console.log(event.point) // Vector3
  console.log(event.distance) // number
  event.stopPropagation()
}

// All event names
type EventName = S3.EventName // "onClick" | "onPointerMove" | ...
```

### Representation Types

These types represent how `three.js` objects can be specified in props:

```tsx
// Vector representations - can be arrays or `three.js` objects
type Position = S3.Vector3 // [x, y, z] | Vector3 | { x, y, z }
type Scale = S3.Vector3

// Color representation
type Color = S3.Color // string | number | Color | [r, g, b]

// Rotation representations
type Rotation = S3.Euler // [x, y, z] | Euler
type Quaternion = S3.Quaternion // [x, y, z, w] | Quaternion

// Other representations
type Layers = S3.Layers // number | Layers
type Matrix = S3.Matrix4 // number[] | Matrix4
```

### Context Type

```tsx
// The full context returned by useThree
type Context = S3.Context

const MyComponent = () => {
  const context: Context = useThree()

  // All properties are properly typed
  context.camera // Camera
  context.gl // WebGLRenderer
  context.pointer // Vector2
  // ... etc
}
```

### Metadata Type

```tsx
// Access instance metadata
type Metadata = S3.Metadata<Mesh>
```

## Performance Optimization

`solid-three` provides several mechanisms to optimize rendering performance:

### Automatic Resource Disposal

`solid-three` automatically manages memory by disposing of THREE.js objects when components are removed from the scene:

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
- Other THREE.js objects with a `dispose()` method

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
- Texture `encoding` property aliased to `colorSpace` for THREE.js r152+ compatibility

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

## Testing

`solid-three` provides a comprehensive testing framework for unit testing 3D components. The testing utilities are available as a separate export.

### Setup and Basic Testing

```tsx
import { test, TestCanvas } from "solid-three/testing"
import { render } from "@solidjs/testing-library"
import { T } from "solid-three"

test("renders a mesh", () => {
  const { canvas, scene, unmount, waitTillNextFrame } = test(() => (
    <T.Mesh>
      <T.BoxGeometry />
      <T.MeshBasicMaterial />
    </T.Mesh>
  ))

  expect(scene.children).toHaveLength(1)
  expect(scene.children[0]).toBeDefined()

  // Clean up
  unmount()
})

// Using TestCanvas for JSX-based testing
test("renders with TestCanvas", () => {
  render(() => (
    <TestCanvas camera={{ position: [0, 0, 5] }}>
      <T.Mesh>
        <T.BoxGeometry />
        <T.MeshBasicMaterial />
      </T.Mesh>
    </TestCanvas>
  ))

  // TestCanvas automatically handles the canvas setup
})
```

### Mock WebGL Context

The testing framework includes a mock WebGL2RenderingContext for environments without GPU support:

```tsx
import { WebGL2RenderingContext } from "solid-three/testing"

// Automatically used when real WebGL is unavailable
// Provides all WebGL methods as no-ops for testing
```

### Testing Events

```tsx
import { fireEvent } from "@solidjs/testing-library"

test("handles click events", () => {
  let clicked = false

  const { canvas } = test(() => (
    <T.Mesh onClick={() => (clicked = true)}>
      <T.BoxGeometry />
      <T.MeshBasicMaterial />
    </T.Mesh>
  ))

  // Create a mock click event on the canvas
  const clickEvent = new MouseEvent("click")
  Object.defineProperty(clickEvent, "offsetX", { get: () => 640 })
  Object.defineProperty(clickEvent, "offsetY", { get: () => 400 })

  fireEvent(canvas, clickEvent)

  expect(clicked).toBe(true)
})
```

### Testing Hooks

```tsx
import { test } from "solid-three/testing"
import { useThree } from "solid-three"

test("useThree returns context", () => {
  let context

  const TestComponent = () => {
    context = useThree()
    return (
      <T.Mesh>
        <T.BoxGeometry />
        <T.MeshBasicMaterial />
      </T.Mesh>
    )
  }

  const { unmount } = test(() => <TestComponent />)

  expect(context.camera).toBeDefined()
  expect(context.gl).toBeDefined()
  expect(context.scene).toBeDefined()

  unmount()
})
```

### Testing Animations

```tsx
test("animates on frame", async () => {
  let rotation = 0

  const AnimatedBox = () => {
    useFrame(() => {
      rotation += 0.01
    })

    return <T.Mesh />
  }

  const { waitTillNextFrame } = test(() => <AnimatedBox />, { frameloop: "always" })

  // Wait for animation frame using test utility
  await waitTillNextFrame()

  expect(rotation).toBeGreaterThan(0)
})
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTION.md) for details on how to get started.

### Dev Container

If you are using VSCode on windows (or just prefer to develope in a container), you can use the included dev container to get started quickly.

1. Clone this repo to a directory _inside of your wsl instance_ such as `~/Github`
2. Navigate to the `solid-three` directory and run `code .`
3. Open the workspace from the provided file.
4. Make sure the [DevContainers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) extension is installed Click the bottom left corner of the window and select `Reopen in Container` - if the extension is installed, vscode should prompt you to open the project in a dev container when you open the workspace file.

#### Dev Container Notes

- We clone into the `wsl` instance because the dev container is running a linux container, and the windows filesystem will cause extreme performance loss due to IO overhead.
- If you are using a different shell, you may need to modify the `devcontainer.json` file to use your shell of choice.
- A port will automatically be forwarded when you run the project in dev mode, so you can access the dev server from your browser on windows at `localhost:<port>` - the port will be displayed in the terminal when you run the project. This can be configured by you as well.

## License

`solid-three` is [MIT licensed](LICENSE).
