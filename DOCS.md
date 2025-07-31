
# Solid-Three: Integrative 3D Rendering with Solid.js

**Solid-Three** is a Solid.js library that enables seamless integration of Three.js, facilitating the creation and manipulation of 3D graphics within a Solid.js framework. This library is a port of the popular React library react-three-fiber, designed to bring its powerful declarative 3D capabilities to the reactive and efficient Solid.js ecosystem.

## Table of Contents

1. Introduction
2. Features
3. Differences from React-Three-Fiber
4. Installation
5. Basic Usage
6. Components
   - Canvas
   - Primitive Components (`<T/>`)
7. Hooks
   - useThree
   - useFrame
   - useLoader
8. Event Handling
9. Advanced Examples
   - Using `<Suspense>` with `useLoader`
10. Contributing
11. License

## Introduction

Solid-Three merges the expressive and detailed world of Three.js with the declarative power of Solid.js. It allows developers to construct complex 3D scenes and animations using a straightforward JSX syntax, bridging the gap between 3D graphics programming and modern web development frameworks.

## Features

- **Declarative Three.js Components**: Utilize Three.js objects as JSX components.
- **Reactive Prop Updates**: Properties of 3D objects update reactively, promoting efficient re-renders.
- **Integrated Animation Loop**: `useFrame` hook allows for easy animations.
- **Comprehensive Event System**: Enhanced event handling with support for Three.js pointer and mouse events.
- **Extensible and Customizable**: Easily extendable with additional Three.js entities or custom behaviors.
- **Optimized for Solid.js**: Leverages Solid.js' fine-grained reactivity for optimal performance.

## Differences from React-Three-Fiber

While Solid-Three is inspired by react-three-fiber, there are several key differences tailored to fit the Solid.js environment:

- **No `performance` Prop**: The `Canvas` component does not support a `performance` prop as optimization is handled differently in Solid.js.
- **No Pointer Capture**: Pointer events do not support pointer capture management.
- **No `onPointerMissed` Event**: This event is not available in Solid-Three.
- **Simplified Event Objects**: The event object provided to event handlers is more minimalistic.
- **Minimal `useThree` Hook**: Returns a more concise context object, focusing on essential properties.

## Installation

\`\`\`
npm install solid-three three
\`\`\`

Ensure that `solid-js` is installed in your environment, as it is a peer dependency of Solid-Three.

## Basic Usage

Here's a simple example to get you started:

\`\`\`
import { Component } from "solid-js";
import { Canvas, T } from "solid-three";
import { Box } from "./components/Box";  // A custom Box component

const App: Component = () => {
  return (
    <Canvas camera={{ position: [0, 0, 5] }}>
      <T.AmbientLight intensity={0.5} />
      <T.PointLight position={[10, 10, 10]} />
      <Box />
    </Canvas>
  );
};
\`\`\`

## Components

### Canvas

The `Canvas` component initializes the Three.js rendering context and acts as the root for your 3D scene.

**Props:**
- **camera**: Configures the camera used in the scene.
- **gl**: Defines options for the WebGLRenderer.
- **scene**: Provides custom settings for the Scene instance.
- **raycaster**: Configures the Raycaster for mouse and pointer events.
- **shadows**: Enables and configures shadows in the scene.
- **orthographic**: Toggles between Orthographic and Perspective camera.
- **style**: Custom CSS styles for the canvas container.
- **frameloop**: Controls the rendering loop's operation mode.

### Primitive Components (`<T/>`)

`<T/>` components are wrappers around Three.js objects, allowing you to insert these objects into your scene declaratively.

Example:
\`\`\`
<T.Mesh>
  <T.BoxGeometry args={[1, 1, 1]} />
  <T.MeshBasicMaterial color={"hotpink"} />
</T.Mesh>
\`\`\`

## Hooks

### useThree

Provides access to the Three.js context, including the renderer, scene, camera, and raycaster. Ideal for accessing these elements to manage scene properties or integrate other libraries.

\`\`\`
const CameraInfo = () => {
  const { camera } = useThree();
  useEffect(() => {
    console.log(`Camera position: ${camera.position.toArray().join(", ")}`);
  }, []);
  
  return null;
};
\`\`\`

### useFrame

Registers a callback that will be called before every frame is rendered, useful for animations and updates.

\`\`\`
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
\`\`\`

### useLoader

Manages asynchronous resource loading, such as textures or models, and integrates with Solid.js' reactivity system. This hook can be used with Solid's `<Suspense>` to handle loading states.

\`\`\`
import { Suspense } from 'solid-js';
import { Canvas, T, useLoader } from 'solid-three';
import { TextureLoader } from 'three';

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
\`\`\`

## Event Handling

Solid-Three enhances Three.js event handling capabilities, integrating them smoothly with Solid.js' reactivity. Events like `onClick`, `onPointerOver`, and others are supported directly on `<T/>` components.

## Advanced Examples

### Using `<Suspense>` with `useLoader`

Here is an advanced example demonstrating how to use the `useLoader` hook with `<Suspense>` for graceful loading state management:

\`\`\`
import { Suspense } from 'solid-js';
import { Canvas, T, useLoader } from 'solid-three';
import { TextureLoader } from 'three';

const MultipleTextures = () => {
  const textures = useLoader(TextureLoader, [
    "/textures/wood.jpg",
    "/textures/metal.jpg"
  ]);

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
\`\`\`
