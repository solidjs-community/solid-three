# Conditional Plugin System for solid-three

This system allows plugins to provide different methods based on the element type, with full TypeScript support.

## How It Works

Due to TypeScript's limitations with conditional generic types, we use function overloads to achieve type-safe conditional plugins.

## Example

```typescript
// 1. Define overloaded interface
interface TransformPluginFn {
  (element: Mesh): {
    lookAt(target: Object3D): void
    bounce(height?: number): void
    spin(speed?: number): void
  }
  (element: Camera): {
    lookAt(target: Object3D): void
    shake(intensity?: number): void
  }
  (element: Light): {
    pulse(minIntensity?: number, maxIntensity?: number): void
  }
  (element: Object3D): {
    lookAt(target: Object3D): void
  }
  (element: any): {}
}

// 2. Create plugin with explicit typing
const TransformPlugin: Plugin<TransformPluginFn> = (() => {
  return ((element: any) => {
    const methods: any = {}
    
    // Base Object3D methods
    if (element instanceof Object3D) {
      methods.lookAt = (target: Object3D) => {
        useFrame(() => element.lookAt(target.position))
      }
    }
    
    // Mesh-specific methods
    if (element instanceof Mesh) {
      methods.bounce = (height = 1) => {
        useFrame((ctx) => {
          element.position.y = Math.abs(Math.sin(ctx.clock.elapsedTime)) * height
        })
      }
      methods.spin = (speed = 1) => {
        useFrame((_, delta) => element.rotation.y += delta * speed)
      }
    }
    
    // Camera-specific methods
    if (element instanceof Camera) {
      methods.shake = (intensity = 0.1) => {
        useFrame(() => {
          element.position.x += (Math.random() - 0.5) * intensity
        })
      }
    }
    
    // Light-specific methods  
    if (element instanceof Light) {
      methods.pulse = (min = 0.5, max = 1) => {
        useFrame((ctx) => {
          const t = (Math.sin(ctx.clock.elapsedTime) + 1) / 2
          element.intensity = min + (max - min) * t
        })
      }
    }
    
    return methods
  }) as TransformPluginFn
})

// 3. Use the plugin
const { T, Canvas } = createT(THREE, [TransformPlugin])

function App() {
  return (
    <Canvas>
      {/* ✅ Mesh gets: lookAt, bounce, spin */}
      <T.Mesh bounce={2} spin={0.5}>
        <T.BoxGeometry />
      </T.Mesh>
      
      {/* ✅ Camera gets: lookAt, shake */}
      <T.PerspectiveCamera shake={0.1} />
      
      {/* ✅ Light gets: pulse */}
      <T.DirectionalLight pulse={0.3} maxIntensity={2} />
      
      {/* ❌ These would cause TypeScript errors: */}
      {/* <T.Mesh shake={0.1} />  */}
      {/* <T.Light bounce={1} />  */}
    </Canvas>
  )
}
```

## Key Points

1. **Order matters**: Place more specific types before general ones
2. **Runtime checks**: Use `instanceof` to determine available methods  
3. **Type safety**: TypeScript enforces correct usage at compile time
4. **Explicit typing**: Use `Plugin<YourPluginFn>` for clear type declarations

## Result

- **Type Safety**: Only correct methods are available for each element type
- **IntelliSense**: Full autocompletion support
- **Error Prevention**: TypeScript catches incorrect usage at compile time