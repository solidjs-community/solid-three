import { For } from "solid-js"
import * as THREE from "three"
import {
  CSS3DObject,
  CSS3DRenderer,
} from "three/addons/renderers/CSS3DRenderer.js"
import { Canvas, createT, Entity, useFrame } from "../../../src/index.ts"
import { OrbitControls } from "../../controls/orbit-controls.tsx"

const T = createT(THREE)

/**
 * `CSS3DRenderer` renders HTML elements positioned in 3D space — no WebGL
 * involved. It satisfies solid-three's `RendererLike` structurally even
 * though it has no `xr`, `shadowMap`, or pixel-ratio APIs.
 *
 * The factory mounts the renderer's `domElement` next to the canvas so the
 * DOM content shows up over it.
 */
function mountCss3d(canvas: HTMLCanvasElement) {
  const renderer = new CSS3DRenderer()
  renderer.domElement.style.position = "absolute"
  renderer.domElement.style.top = "0"
  renderer.domElement.style.left = "0"
  renderer.domElement.style.width = "100%"
  renderer.domElement.style.height = "100%"
  renderer.domElement.style.pointerEvents = "none"
  canvas.parentElement?.appendChild(renderer.domElement)
  return renderer
}

const cards = [
  { label: "solid", color: "#2c4f7c" },
  { label: "three", color: "#000000" },
  { label: "css3d", color: "#b91c1c" },
  { label: "renderer", color: "#16a34a" },
  { label: "like", color: "#9333ea" },
  { label: "duck-typed", color: "#ea580c" },
]

function Card(props: { label: string; color: string; index: number }) {
  const element = (
    <div
      style={{
        width: "200px",
        height: "120px",
        display: "flex",
        "align-items": "center",
        "justify-content": "center",
        font: "600 28px system-ui, sans-serif",
        color: "white",
        background: props.color,
        border: "4px solid white",
        "border-radius": "12px",
        "box-shadow": "0 8px 30px rgba(0,0,0,0.35)",
      }}
    >
      {props.label}
    </div>
  ) as unknown as HTMLDivElement
  const css = new CSS3DObject(element)

  const angle = (props.index / cards.length) * Math.PI * 2
  const radius = 400
  css.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius)
  css.lookAt(0, 0, 0)
  css.rotateY(Math.PI)

  return <Entity from={css} />
}

function Carousel() {
  let group: THREE.Group = null!
  useFrame((_, delta) => {
    group.rotation.y += delta * 0.3
  })
  return (
    <T.Group ref={group}>
      <For each={cards}>{(card, i) => <Card {...card} index={i()} />}</For>
    </T.Group>
  )
}

export default function () {
  return (
    <Canvas
      style={{ background: "#1a1a24" }}
      camera={{ position: new THREE.Vector3(0, 0, 800), fov: 50 }}
      gl={mountCss3d}
    >
      <OrbitControls />
      <Carousel />
    </Canvas>
  )
}
