import * as THREE from "three"
import { Canvas, createT, Portal, useFrame, useThree } from "solid-three"

const T = createT(THREE)

// Off-screen scene + camera + render target. Each frame we render the
// off-screen scene into the target; the target's texture is then used as
// the `map` on a material in the main scene.
const offscreenScene = new THREE.Scene()
const offscreenCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 100)
offscreenCamera.position.z = 2.5
const renderTarget = new THREE.WebGLRenderTarget(512, 512)

function CopyOffscreenToTexture() {
  const context = useThree()
  useFrame(() => {
    const gl = context.gl as THREE.WebGLRenderer
    gl.setRenderTarget(renderTarget)
    gl.render(offscreenScene, offscreenCamera)
    gl.setRenderTarget(null)
  })
  return null
}

function SpinningKnot() {
  let mesh: THREE.Mesh | undefined
  useFrame((_context, delta) => {
    if (!mesh) return
    mesh.rotation.x += delta * 0.6
    mesh.rotation.y += delta * 0.9
  })
  return (
    <T.Mesh ref={mesh}>
      <T.TorusKnotGeometry args={[0.6, 0.22, 128, 32]} />
      <T.MeshNormalMaterial />
    </T.Mesh>
  )
}

function TexturedCube() {
  let mesh: THREE.Mesh | undefined
  useFrame((_context, delta) => {
    if (!mesh) return
    mesh.rotation.x += delta * 0.4
    mesh.rotation.y += delta * 0.6
  })
  return (
    <T.Mesh ref={mesh}>
      <T.BoxGeometry />
      <T.MeshBasicMaterial map={renderTarget.texture} />
    </T.Mesh>
  )
}

export default function App() {
  return (
    <Canvas camera={{ position: [0, 0, 3] }} scene={{ background: new THREE.Color("#101218") }}>
      {/* Portal sends the knot into the off-screen scene instead of the
          canvas's main scene. */}
      <Portal element={offscreenScene}>
        <SpinningKnot />
        <T.AmbientLight intensity={0.3} />
        <T.DirectionalLight position={[2, 2, 2]} intensity={2} />
      </Portal>

      {/* Each frame, render off-screen → target. */}
      <CopyOffscreenToTexture />

      {/* The cube in the main scene wears the target's texture on every
          face — and rotates so all six are visible over time. */}
      <TexturedCube />
    </Canvas>
  )
}
