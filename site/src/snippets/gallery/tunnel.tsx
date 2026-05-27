import { createMemo, createSignal, onCleanup, onMount } from "solid-js"
import { Canvas, createT, useFrame } from "solid-three"
import * as THREE from "three"
import fontUrl from "../../IFKica-Regular.ttf?url"

const T = createT(THREE)

const FONT_FAMILY = "IFKica-Tunnel"
const TEXT = "SOLID THREE"
const TUBE_LENGTH = 60
const TUBE_RADIUS = 2.2
const TUBULAR_SEGMENTS = 96
const RADIAL_SEGMENTS = 32
const TEXTURE_REPEAT_U = 4
const TEXTURE_REPEAT_V = 18
const CURVE_SEGMENTS = 14

// Snippets run inside an iframe with its own document. We load the font via
// FontFace against the iframe's document.fonts so the canvas texture renders
// the real face instead of the sans-serif fallback.
const [tunnelFontReady, setTunnelFontReady] = createSignal(false)

let tunnelFontLoadStarted = false
function ensureTunnelFontLoaded(): void {
  if (tunnelFontLoadStarted) return
  tunnelFontLoadStarted = true
  const face = new FontFace(FONT_FAMILY, `url(${JSON.stringify(fontUrl)})`)
  face
    .load()
    .then(loaded => {
      document.fonts.add(loaded)
      setTunnelFontReady(true)
    })
    .catch(error => {
      console.error("[tunnel] font load failed", error)
    })
}

function makeTextTexture(): THREE.CanvasTexture {
  // Equirectangular layout: width = 360° longitude, height = 180° latitude.
  // Text sits in a horizontal band at the equator (latitude 0). Above/below
  // is solid background — won't be visible inside the tube interior anyway.
  const width = 4096
  const height = 2048
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("tunnel: 2d context unavailable")
  ctx.fillStyle = "#0a0c12"
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = "#f4f4f4"
  const bandHeight = height * 0.28
  ctx.font = `${bandHeight * 0.85}px ${FONT_FAMILY}, sans-serif`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  const repeats = 1 /* TEXTURE_REPEAT_U */
  const sectionWidth = width / repeats
  for (let i = 0; i < repeats; i++) {
    ctx.fillText(TEXT, sectionWidth * (i + 0.5), height / 4)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.mapping = THREE.EquirectangularReflectionMapping
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 16
  return texture
}

function buildCurve(timeMs: number): THREE.CatmullRomCurve3 {
  const points: THREE.Vector3[] = []
  const t = timeMs / 1000
  for (let i = 0; i <= CURVE_SEGMENTS; i++) {
    const u = i / CURVE_SEGMENTS
    const z = -u * TUBE_LENGTH
    // First control point pinned to origin so the tube mouth stays around the
    // camera; subsequent points wander increasingly with curve depth.
    const sway = u * u
    const phaseX = t * 0.35 + u * 1.6
    const phaseY = t * 0.27 + u * 2.1
    const x = Math.sin(phaseX) * sway * 18
    const y = Math.cos(phaseY) * sway * 12
    points.push(new THREE.Vector3(x, y, z))
  }
  return new THREE.CatmullRomCurve3(points)
}

function Tunnel() {
  onMount(() => ensureTunnelFontLoaded())

  const texture = createMemo(() => {
    tunnelFontReady() // track — rebuild texture once font lands
    const t = makeTextTexture()
    onCleanup(() => t.dispose())
    return t
  })

  const material = createMemo(() => {
    const m = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      envMap: texture(),
      side: THREE.BackSide,
      combine: THREE.MultiplyOperation,
      reflectivity: 1,
    })
    m.envMapRotation = new THREE.Euler(0, 0, 0)
    onCleanup(() => m.dispose())
    return m
  })

  let mesh: THREE.Mesh | undefined
  const startTime = performance.now()

  useFrame((_, delta) => {
    const now = performance.now()
    const m = material()
    m.envMapRotation.y += delta * 0.25
    if (!mesh) return
    mesh.geometry.dispose()
    const curve = buildCurve(now - startTime)
    mesh.geometry = new THREE.TubeGeometry(
      curve,
      TUBULAR_SEGMENTS,
      TUBE_RADIUS,
      RADIAL_SEGMENTS,
      false,
    )
  })

  onCleanup(() => {
    mesh?.geometry.dispose()
  })

  return (
    <T.Mesh ref={m => (mesh = m)} material={material()}>
      {/* placeholder — overwritten on first frame */}
      <T.BoxGeometry args={[0.01, 0.01, 0.01]} />
    </T.Mesh>
  )
}

export default function TunnelDemo() {
  return (
    <Canvas camera={{ position: [0, 0, 0.5], fov: 78, near: 0.01, far: 200 }}>
      <T.Color attach="background" args={["#0a0c12"]} />
      <Tunnel />
    </Canvas>
  )
}
