# Solid-Three: Integrative 3D Rendering with Solid.js

`solid-three` is a Solid.js library that enables seamless integration of `three.js`, facilitating the creation and manipulation of 3D graphics within a Solid.js framework. This library is a port of the popular React library [`react-three-fiber`](https://github.com/pmndrs/react-three-fiber), designed to bring its powerful declarative 3D capabilities to the reactive and efficient Solid.js ecosystem.

## Table of Contents

1. [Introduction](#introduction)
2. [Features](#features)
3. [Differences from React-Three-Fiber](#differences-from-react-three-fiber)
4. [Installation](#installation)
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
8. [Core APIs](#core-apis)
   - [extend](#extend)
   - [applyProps](#applyprops)
   - [augment](#augment)
   - [buildGraph](#buildgraph)
9. [Event Handling](#event-handling)
10. [TypeScript Support](#typescript-support)
11. [Advanced Usage](#advanced-usage)
    - [Using `<Suspense>` with `useLoader`](#using-suspense-with-useloader)
    - [Performance Optimization](#performance-optimization)
12. [Testing](#testing)
13. [API Reference](#api-reference)
14. [Contributing](#contributing)
15. [License](#license)

## Introduction

`solid-three` merges the expressive and detailed world of `three.js` with the declarative power of Solid.js. It allows developers to construct complex 3D scenes and animations using a straightforward JSX syntax, bridging the gap between 3D graphics programming and modern web development frameworks.

## Features

- **Declarative `three.js` Components**: Utilize `three.js` objects as JSX components.
- **Reactive Prop Updates**: Properties of 3D objects update reactively, promoting efficient re-renders.
- **Integrated Animation Loop**: `useFrame` hook allows for easy animations.
- **Comprehensive Event System**: Enhanced event handling with support for `three.js` pointer and mouse events.
- **Extensible and Customizable**: Easily extendable with additional `three.js` entities or custom behaviors.
- **Optimized for Solid.js**: Leverages Solid.js' fine-grained reactivity for optimal performance.

## Differences from React-Three-Fiber

While `solid-three` is inspired by react-three-fiber, there are several key differences tailored to fit the Solid.js environment:

- **No `performance` Prop**: The `Canvas` component does not support a `performance` prop as optimization is handled differently in Solid.js.
- **No Pointer Capture**: Pointer events do not support pointer capture management.
- **No `onPointerMissed` Event**: This event is not available in `solid-three`.
- **Simplified Event Objects**: The event object provided to event handlers is more minimalistic.
- **Minimal `useThree` Hook**: Returns a more concise context object, focusing on essential properties.

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
import { Component } from "solid-js";
import { Canvas, T } from "solid-three";

const Box = () => {
  let mesh: Mesh | undefined;
  const [hovered, setHovered] = createSignal(false);

  useFrame(() => (mesh!.rotation.y += 0.01));

  return (
    <T.Mesh
      ref={mesh}
      onPointerEnter={e => setHovered(true)}
      onPointerLeave={e => setHovered(false)}
    >
      <T.BoxGeometry />
      <T.MeshStandardMaterial color={hovered() ? "green" : "red"} />
    </T.Mesh>
  );
};

const App: Component = () => {
  return (
    <Canvas camera={{ position: [0, 0, 5] }}>
      <T.AmbientLight intensity={0.5} />
      <T.PointLight position={[10, 10, 10]} />
      <Box />
    </Canvas>
  );
};
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
  gl={{ antialias: true, alpha: true }}
  shadows="soft"
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

### Portal

The `Portal` component allows you to place children outside the regular scene graph while maintaining reactive updates. This is useful for rendering objects into different scenes or bypassing the normal parent-child relationships.

**Props:**

- **element** (`Object3D | S3.Instance<Object3D>`): Optional `three.js` object to render into. If not provided, renders into the root scene.
- **children** (`JSX.Element`): Elements to render in the portal.

Example:

```tsx
import { Portal } from "solid-three";

// Create a separate scene for UI elements
const uiScene = new Scene();

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
  );
};
```

### Primitive

The `Primitive` component wraps existing `three.js` objects and allows them to be used as JSX components within solid-three. This is useful when you have pre-created `three.js` objects or when working with objects from external libraries.

**Props:**

- **object** (`T extends ThreeInstance`): The `three.js` object to wrap.
- **ref** (`T | ((value: T) => void)`): Optional ref to access the object.
- Any additional props supported by the `three.js` object.

Example:

```tsx
import { Primitive } from "solid-three";
import { Mesh, BoxGeometry, MeshBasicMaterial } from "three";

// Create `three.js` objects imperatively
const geometry = new BoxGeometry(1, 1, 1);
const material = new MeshBasicMaterial({ color: "orange" });
const mesh = new Mesh(geometry, material);

const App = () => {
  return (
    <Canvas>
      {/* Use the existing mesh in the declarative scene */}
      <Primitive object={mesh} position={[0, 0, 0]} onClick={() => console.log("Clicked!")} />
    </Canvas>
  );
};
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
- **render** (`() => void`): Function to manually trigger a render.
- **requestRender** (`() => void`): Function to request a render on the next frame.
- **xr** (`WebXRManager`): The WebXR manager for VR/AR experiences.
- **bounds** (`DOMRect`): The canvas bounding rectangle.

**Usage:**

```tsx
// Get the entire context
const context = useThree();

// Use with a selector for specific properties
const camera = useThree(state => state.camera);
const { gl, scene } = useThree(state => ({ gl: state.gl, scene: state.scene }));

// Example: Manual rendering control
const { requestRender } = useThree();
const handleUpdate = () => {
  // Perform updates
  requestRender(); // Request a render for the next frame
};
```

### useFrame

Registers a callback that will be called before every frame is rendered, useful for animations and updates.

```tsx
const RotatingMesh = () => {
  useFrame(({ delta }) => {
    const { scene } = useThree();
    scene.children[0].rotation.y += delta * Math.PI;
  });

  return (
    <T.Mesh>
      <T.BoxGeometry />
      <T.MeshStandardMaterial color="purple" />
    </T.Mesh>
  );
};
```

### useLoader

Manages asynchronous resource loading, such as textures or models, and integrates with Solid.js' reactivity system. This hook can be used with Solid's `<Suspense>` to handle loading states.

```tsx
import { Suspense } from "solid-js";
import { Canvas, T, useLoader } from "solid-three";
import { TextureLoader } from "three";

const TexturedSphere = () => {
  const texture = useLoader(TextureLoader, "path/to/texture.jpg");

  return (
    <T.Mesh>
      <T.SphereGeometry args={[5, 32, 32]} />
      <T.MeshBasicMaterial map={texture()} />
    </T.Mesh>
  );
};

export const App = () => {
  return (
    <Canvas>
      <Suspense fallback={<div>Loading...</div>}>
        <TexturedSphere />
      </Suspense>
    </Canvas>
  );
};
```

## Core APIs

### extend

Registers `three.js` classes with the solid-three component system, making them available as `<T.*>` components. This must be called before using any `three.js` class as a component.

```tsx
import { extend } from "solid-three";
import { Mesh, BoxGeometry, MeshBasicMaterial, PointLight, AmbientLight } from "three";

// Register `three.js` classes
extend({
  Mesh,
  BoxGeometry,
  MeshBasicMaterial,
  PointLight,
  AmbientLight,
});

// Now you can use them as components
<T.Mesh>
  <T.BoxGeometry />
  <T.MeshBasicMaterial />
</T.Mesh>;
```

### applyProps

Applies props to `three.js` instances with special handling for nested properties, colors, and vectors. Automatically sets `needsUpdate` flags where necessary.

```tsx
import { applyProps } from "solid-three";

const mesh = new Mesh();

// Applies multiple props at once
applyProps(mesh, {
  position: [1, 2, 3], // Converts array to Vector3
  "material.color": "red", // Nested property access
  "rotation.x": Math.PI / 2, // Direct property access
  visible: false,
});
```

**Special prop handling:**

- Arrays are converted to appropriate `three.js` types (Vector3, Euler, etc.)
- Colors are automatically converted with proper color space management
- Nested properties can be accessed with dot notation
- Automatically handles `needsUpdate` flags

### augment

Adds solid-three metadata to `three.js` instances, enabling them to work with the reactive system. This is automatically called by components but can be used manually.

```tsx
import { augment, $S3C } from "solid-three";

const mesh = new Mesh();
const augmentedMesh = augment(mesh, {
  props: { position: [0, 0, 0] },
});

// Access metadata
console.log(augmentedMesh[$S3C]); // { props, instance, ... }
```

### buildGraph

Traverses an Object3D hierarchy and collects all named nodes and materials into a flat structure. Useful for working with loaded models.

```tsx
import { buildGraph, useLoader } from "solid-three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

const Model = () => {
  const gltf = useLoader(GLTFLoader, "/model.gltf");

  const graph = createMemo(() => {
    const { nodes, materials } = buildGraph(gltf().scene);
    return { nodes, materials };
  });

  // Access specific parts of the model
  return <Primitive object={graph().nodes.Cube} material={graph().materials.Metal} />;
};
```

## Event Handling

`solid-three` provides a comprehensive event system that integrates `three.js` pointer and mouse events with Solid.js' reactivity. Events are automatically handled through raycasting and support stopping propagation.

**Supported Events:**

**Mouse Events:**

- `onClick` - Fired when clicking on an object
- `onDoubleClick` - Fired when double-clicking on an object
- `onContextMenu` - Fired on right-click
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
- `onPointerMissed` - Fired when clicking outside any object

**Event Object:**

Event handlers receive an enhanced event object with the following properties:

```tsx
interface ThreeEvent<T> {
  // Original DOM event
  nativeEvent: T;

  // `three.js` specific properties
  point: Vector3; // 3D point of intersection
  distance: number; // Distance from camera to intersection
  normal: Vector3; // Surface normal at intersection
  face: Face; // Face that was hit
  object: Object3D; // The object that was hit

  // Event control
  stopPropagation: () => void;
}
```

**Example:**

```tsx
const InteractiveCube = () => {
  const [hovered, setHovered] = createSignal(false);
  const [clicked, setClicked] = createSignal(0);

  return (
    <T.Mesh
      onClick={e => {
        e.stopPropagation();
        setClicked(c => c + 1);
        console.log("Clicked at:", e.point);
      }}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onWheel={e => console.log("Wheel delta:", e.nativeEvent.deltaY)}
    >
      <T.BoxGeometry />
      <T.MeshStandardMaterial
        color={hovered() ? "hotpink" : "orange"}
        emissive={clicked() > 0 ? "red" : "black"}
      />
    </T.Mesh>
  );
};
```

**Event Propagation:**

Events bubble up through the `three.js` scene graph. Use `stopPropagation()` to prevent bubbling:

```tsx
<T.Group onClick={() => console.log("Group clicked")}>
  <T.Mesh
    onClick={e => {
      e.stopPropagation(); // Prevents group click handler
      console.log("Mesh clicked");
    }}
  >
    {/* ... */}
  </T.Mesh>
</T.Group>
```

## TypeScript Support

`solid-three` provides comprehensive TypeScript support through the `S3` namespace, which contains all type definitions for working with `three.js` in a type-safe manner.

### Core Types

```tsx
import type { S3 } from "solid-three";

// Component types
type MeshComponent = S3.Component<Mesh>;
type BoxProps = S3.ClassProps<BoxGeometry>;

// Instance types - `three.js` objects augmented with solid-three metadata
type AugmentedMesh = S3.Instance<Mesh>;

// Generic Three instance
type AnyInstance = S3.ThreeInstance;

// Camera types
type Camera = S3.CameraType; // PerspectiveCamera | OrthographicCamera
```

### Props Types

```tsx
// Get props type for a specific `three.js` class
type MeshProps = S3.Props<"Mesh">;
type MaterialProps = S3.Props<"MeshStandardMaterial">;

// Using in components
const MyMesh = (props: MeshProps) => {
  return <T.Mesh {...props} />;
};
```

### Event Types

```tsx
// Event handler types
type ClickHandler = S3.EventHandlers["onClick"];
type PointerHandler = S3.EventHandlers["onPointerMove"];

// Event object type
const handleClick: ClickHandler = (event: S3.Event<MouseEvent>) => {
  console.log(event.point); // Vector3
  console.log(event.distance); // number
  event.stopPropagation();
};

// All event names
type EventName = S3.EventName; // "onClick" | "onPointerMove" | ...
```

### Representation Types

These types represent how `three.js` objects can be specified in props:

```tsx
// Vector representations - can be arrays or `three.js` objects
type Position = S3.Vector3; // [x, y, z] | Vector3 | { x, y, z }
type Scale = S3.Vector3;

// Color representation
type Color = S3.Color; // string | number | Color | [r, g, b]

// Rotation representations
type Rotation = S3.Euler; // [x, y, z] | Euler
type Quaternion = S3.Quaternion; // [x, y, z, w] | Quaternion

// Other representations
type Layers = S3.Layers; // number | Layers
type Matrix = S3.Matrix4; // number[] | Matrix4
```

### Context Type

```tsx
// The full context returned by useThree
type Context = S3.Context;

const MyComponent = () => {
  const context: Context = useThree();

  // All properties are properly typed
  context.camera; // Camera
  context.gl; // WebGLRenderer
  context.pointer; // Vector2
  // ... etc
};
```

### Metadata Type

```tsx
// Access instance metadata
type Metadata = S3.Metadata<Mesh>;

const mesh = new Mesh();
const augmented = augment(mesh, { props: {} });
const metadata: Metadata = augmented[$S3C];
```

### Practical Examples

```tsx
import type { S3 } from "solid-three";
import { Component } from "solid-js";

// Typed component with props
type BoxProps = {
  size?: S3.Vector3;
  color?: S3.Color;
  onClick?: S3.EventHandlers["onClick"];
};

const Box: Component<BoxProps> = props => {
  return (
    <T.Mesh onClick={props.onClick}>
      <T.BoxGeometry args={props.size || [1, 1, 1]} />
      <T.MeshStandardMaterial color={props.color || "white"} />
    </T.Mesh>
  );
};

// Using generic instance types
const processInstance = (instance: S3.Instance) => {
  // Access metadata
  const metadata = instance[$S3C];
  console.log(metadata.props);
};

// Type-safe event handling
const InteractiveObject: Component = () => {
  const handlePointer: S3.EventHandlers["onPointerMove"] = e => {
    // e is fully typed as S3.Event<PointerEvent>
    console.log(`Pointer at: ${e.point.toArray()}`);
  };

  return <T.Mesh onPointerMove={handlePointer} />;
};
```

## Advanced Examples

### Using `<Suspense>` with `useLoader`

Here is an advanced example demonstrating how to use the `useLoader` hook with `<Suspense>` for graceful loading state management:

```tsx
import { Suspense } from "solid-js";
import { Canvas, T, useLoader } from "solid-three";
import { TextureLoader } from "three";

const MultipleTextures = () => {
  const textures = useLoader(TextureLoader, ["/textures/wood.jpg", "/textures/metal.jpg"]);

  return textures().map(texture => (
    <T.Mesh>
      <T.PlaneGeometry args={[5, 5]} />
      <T.MeshBasicMaterial map={texture} />
    </T.Mesh>
  ));
};

export const App = () => {
  return (
    <Canvas>
      <Suspense fallback={<div>Loading Textures...</div>}>
        <MultipleTextures />
      </Suspense>
    </Canvas>
  );
};
```

### Performance Optimization

`solid-three` provides several mechanisms to optimize rendering performance:

#### Frame Loop Control

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

#### Manual Rendering

When using `frameloop="demand"` or `"never"`, you can manually trigger renders:

```tsx
const ManualRender = () => {
  const { render, requestRender } = useThree();

  // Immediate render
  const forceRender = () => render();

  // Request render on next frame
  const updateScene = () => {
    // Make changes
    requestRender();
  };

  return <T.Mesh onClick={updateScene} />;
};
```

#### Conditional Frame Updates

Use the second parameter of `useFrame` to conditionally execute updates:

```tsx
const OptimizedAnimation = () => {
  let mesh: Mesh;
  const [isAnimating, setIsAnimating] = createSignal(true);

  useFrame((state, delta) => {
    if (!isAnimating()) return; // Skip if not animating

    mesh.rotation.y += delta;
  });

  return <T.Mesh ref={mesh} onClick={() => setIsAnimating(!isAnimating())} />;
};
```

#### Texture Optimization

Configure texture filtering for better performance:

```tsx
// Disable expensive texture filtering
<Canvas linear={false} flat>
  {/* Your scene */}
</Canvas>
```

#### Instance Reuse

Reuse `three.js` objects across components:

```tsx
// Create shared geometry
const sharedGeometry = new BoxGeometry(1, 1, 1);

const OptimizedBoxes = () => {
  return (
    <>
      {Array.from({ length: 100 }, (_, i) => (
        <Primitive object={new Mesh(sharedGeometry)} position={[i * 2, 0, 0]} />
      ))}
    </>
  );
};
```

#### Automatic Disposal

`solid-three` automatically disposes of `three.js` objects when components unmount, preventing memory leaks. However, for shared resources, manage disposal manually:

```tsx
const SharedResource = () => {
  const texture = useLoader(TextureLoader, "/texture.jpg");

  onCleanup(() => {
    // Manual cleanup for shared resources if needed
    texture()?.dispose();
  });

  return <T.MeshBasicMaterial map={texture()} />;
};
```

## Testing

`solid-three` provides a comprehensive testing framework for unit testing 3D components. The testing utilities are available as a separate export.

### Setup

```tsx
import { test, TestCanvas } from "solid-three/testing";
import { render } from "@solidjs/testing-library";

// Initialize the testing environment
test();
```

### TestCanvas

A specialized Canvas component optimized for testing:

```tsx
import { TestCanvas } from "solid-three/testing";
import { render, screen } from "@solidjs/testing-library";

test("renders a mesh", () => {
  render(() => (
    <TestCanvas>
      <T.Mesh testId="my-mesh">
        <T.BoxGeometry />
        <T.MeshBasicMaterial />
      </T.Mesh>
    </TestCanvas>
  ));

  const mesh = screen.getByTestId("my-mesh");
  expect(mesh).toBeDefined();
});
```

### Mock WebGL Context

The testing framework includes a mock WebGL2RenderingContext for environments without GPU support:

```tsx
import { WebGL2RenderingContext } from "solid-three/testing";

// Automatically used when real WebGL is unavailable
// Provides all WebGL methods as no-ops for testing
```

### Testing Events

```tsx
import { fireEvent } from "@solidjs/testing-library";

test("handles click events", async () => {
  let clicked = false;

  render(() => (
    <TestCanvas>
      <T.Mesh testId="clickable" onClick={() => (clicked = true)}>
        <T.BoxGeometry />
        <T.MeshBasicMaterial />
      </T.Mesh>
    </TestCanvas>
  ));

  const mesh = screen.getByTestId("clickable");
  fireEvent.click(mesh);

  expect(clicked).toBe(true);
});
```

### Testing Hooks

```tsx
import { renderHook } from "@solidjs/testing-library";

test("useThree returns context", () => {
  const { result } = renderHook(() => useThree(), {
    wrapper: ({ children }) => <TestCanvas>{children}</TestCanvas>,
  });

  expect(result.camera).toBeDefined();
  expect(result.gl).toBeDefined();
  expect(result.scene).toBeDefined();
});
```

### Testing Animations

```tsx
test("animates on frame", async () => {
  let rotation = 0;

  const AnimatedBox = () => {
    useFrame(() => {
      rotation += 0.01;
    });

    return <T.Mesh />;
  };

  render(() => (
    <TestCanvas frameloop="always">
      <AnimatedBox />
    </TestCanvas>
  ));

  // Wait for animation frames
  await new Promise(resolve => setTimeout(resolve, 100));

  expect(rotation).toBeGreaterThan(0);
});
```

## API Reference

### Components

| Component   | Description                                                                     |
| ----------- | ------------------------------------------------------------------------------- |
| `Canvas`    | Root component that initializes `three.js` rendering context                    |
| `T.*`       | Dynamic components for all `three.js` classes (e.g., `T.Mesh`, `T.BoxGeometry`) |
| `Portal`    | Renders children outside the normal scene graph                                 |
| `Primitive` | Wraps existing `three.js` objects as components                                 |

### Hooks

| Hook        | Description                    | Returns                        |
| ----------- | ------------------------------ | ------------------------------ |
| `useThree`  | Access `three.js` context      | `S3.Context` or selected value |
| `useFrame`  | Register frame update callback | `void`                         |
| `useLoader` | Load assets with caching       | `Resource<T>`                  |

### Core Functions

| Function     | Description                      | Parameters                |
| ------------ | -------------------------------- | ------------------------- |
| `extend`     | Register `three.js` classes      | `{ [name]: Constructor }` |
| `applyProps` | Apply props to instances         | `(instance, props)`       |
| `augment`    | Add metadata to instances        | `(instance, metadata)`    |
| `buildGraph` | Traverse and collect scene nodes | `(object3D)`              |

### Event Handlers

| Event | Description |
|-------|-------------|
| `onClick` | Click/tap on object |
| `onDoubleClick` | Double click on object |
| `onContextMenu` | Right click on object |
| `onPointerDown` | Pointer pressed |
| `onPointerUp` | Pointer released |
| `onPointerMove` | Pointer moves |
| `onPointerEnter` | Pointer enters object |
| `onPointerLeave` | Pointer leaves object |
| `onMouseDown` | Mouse button pressed |
| `onMouseUp` | Mouse button released |
| `onMouseMove` | Mouse moves over object |
| `onMouseEnter` | Mouse enters object |
| `onMouseLeave` | Mouse leaves object |
| `onWheel` | Mouse wheel event |
| `onPointerMissed` | Click outside any object |

### Type Exports (S3 namespace)

| Type               | Description                         |
| ------------------ | ----------------------------------- |
| `S3.Context`       | `three.js` context interface        |
| `S3.Instance<T>`   | Augmented `three.js` instance       |
| `S3.Component<T>`  | Component type for `three.js` class |
| `S3.ClassProps<T>` | Props for `three.js` class          |
| `S3.Props<T>`      | Props by class name                 |
| `S3.Event<T>`      | Event wrapper type                  |
| `S3.EventHandlers` | All event handler types             |
| `S3.Vector2/3/4`   | Vector representations              |
| `S3.Color`         | Color representation                |
| `S3.Euler`         | Euler angle representation          |
| `S3.Quaternion`    | Quaternion representation           |

### Canvas Props

| Prop           | Type                                         | Description              |
| -------------- | -------------------------------------------- | ------------------------ |
| `camera`       | `Camera \| CameraProps`                      | Camera configuration     |
| `gl`           | `WebGLRenderer \| RendererProps \| Function` | Renderer configuration   |
| `scene`        | `Scene \| SceneProps`                        | Scene configuration      |
| `raycaster`    | `Raycaster \| RaycasterProps`                | Raycaster for events     |
| `shadows`      | `boolean \| ShadowMapType`                   | Shadow configuration     |
| `frameloop`    | `"always" \| "demand" \| "never"`            | Render loop mode         |
| `orthographic` | `boolean`                                    | Use orthographic camera  |
| `linear`       | `boolean`                                    | Linear texture filtering |
| `flat`         | `boolean`                                    | Flat texture filtering   |
| `fallback`     | `JSX.Element`                                | Loading fallback         |

### Symbols

| Symbol | Description                                    |
| ------ | ---------------------------------------------- |
| `$S3C` | Metadata storage symbol on augmented instances |

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTION.md) for details on how to get started.

## License

`solid-three` is [MIT licensed](LICENSE).
