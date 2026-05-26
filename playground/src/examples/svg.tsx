import * as THREE from "three"
import { SVGRenderer } from "three/addons/renderers/SVGRenderer.js"
import { Canvas, createT, useFrame } from "../../../src/index.ts"
import { OrbitControls } from "../../controls/orbit-controls.tsx"

const T = createT(THREE)

/**
 * `SVGRenderer` rasterises the three.js scene into vector SVG paths — no
 * WebGL, no DOM positioning tricks like CSS3DRenderer. The same scene
 * graph (meshes, materials, lights) works directly.
 *
 * It satisfies `RendererLike` structurally: `render`, `setSize`,
 * `setPixelRatio` (no-op), no `getPixelRatio`, no `xr`, no `shadowMap`,
 * no `init`. solid-three's `context.dpr` falls back to `1`.
 */
function mountSvg(canvas: HTMLCanvasElement) {
  const renderer = new SVGRenderer()
  renderer.domElement.setAttribute("style", "position:absolute;inset:0;width:100%;height:100%")
  canvas.parentElement?.appendChild(renderer.domElement)
  return renderer
}

function SpinningShapes() {
  let group: THREE.Group = null!
  useFrame((_, delta) => {
    group.rotation.x += delta * 0.4
    group.rotation.y += delta * 0.6
  })
  return (
    <T.Group ref={group}>
      <T.Mesh position={[-2, 0, 0]}>
        <T.IcosahedronGeometry args={[1, 0]} />
        <T.MeshBasicMaterial color="#9b59ff" wireframe />
      </T.Mesh>
      <T.Mesh position={[0, 0, 0]}>
        <T.BoxGeometry args={[1.4, 1.4, 1.4]} />
        <T.MeshLambertMaterial color="#16a34a" />
      </T.Mesh>
      <T.Mesh position={[2, 0, 0]}>
        <T.ConeGeometry args={[0.8, 1.6, 16]} />
        <T.MeshLambertMaterial color="#ea580c" />
      </T.Mesh>
    </T.Group>
  )
}

export default function () {
  return (
    <Canvas
      style={{ background: "#f5f5f0" }}
      camera={{ position: new THREE.Vector3(0, 0, 6) }}
      gl={mountSvg}
    >
      <OrbitControls />
      <T.AmbientLight intensity={0.4} />
      <T.DirectionalLight position={[3, 3, 3]} intensity={1.5} />
      <SpinningShapes />
    </Canvas>
  )
}
