import * as THREE from "three"
import { Canvas, createT } from "solid-three"
import { createSignal, For, onMount } from "solid-js"
import { FontLoader, type Font } from "three/examples/jsm/loaders/FontLoader.js"
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js"

const T = createT(THREE)

const FONT_URL =
  "https://esm.sh/three@0.181/examples/fonts/helvetiker_bold.typeface.json"

const LETTERS = ["S", "O", "L", "I", "D", "T", "H", "R", "E", "E"] as const
const SOLID_BLUE = "#2c4f7c"
const WARM_WHITE = "#f4f4f4"

function colorFor(index: number): string {
  return index < 5 ? SOLID_BLUE : WARM_WHITE
}

function startXFor(index: number): number {
  const gap = index < 5 ? 0 : 0.6
  return (index - 4.5) * 0.9 + gap
}

export default function Hero() {
  const [font, setFont] = createSignal<Font | undefined>()

  onMount(() => {
    new FontLoader().load(
      FONT_URL,
      loaded => setFont(loaded),
      undefined,
      error => console.error("[hero] font load failed", error),
    )
  })

  return (
    <Canvas camera={{ position: [0, 1.5, 6], fov: 45 }}>
      <T.AmbientLight intensity={0.5} />
      <For each={LETTERS}>
        {(letter, i) => {
          const f = font()
          if (!f) return null
          const geometry = new TextGeometry(letter, {
            font: f,
            size: 0.8,
            height: 0.25,
            curveSegments: 8,
            bevelEnabled: true,
            bevelSize: 0.02,
            bevelThickness: 0.02,
            bevelSegments: 2,
          })
          geometry.center()
          return (
            <T.Mesh
              geometry={geometry}
              position={[startXFor(i()), 0, 0]}
            >
              <T.MeshStandardMaterial color={colorFor(i())} />
            </T.Mesh>
          )
        }}
      </For>
    </Canvas>
  )
}
