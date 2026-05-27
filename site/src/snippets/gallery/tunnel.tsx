import { createMemo, createSignal, onCleanup, onMount } from "solid-js"
import { Canvas, createT, useFrame, useThree } from "solid-three"
import * as THREE from "three"
import fontUrl from "../../IFKica-Regular.ttf?url"

const T = createT(THREE)

const FONT_FAMILY = "IFKica-Tunnel"
const TEXT = "SOLID THREE  "
const TUBE_RADIUS = 2.2
const TUBULAR_SEGMENTS = 512
const RADIAL_SEGMENTS = 32
const TEXTURE_REPEAT_U = 6
const TEXTURE_REPEAT_V = 12
const LOOP_DURATION_SECONDS = 40

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
  const width = 2048
  const height = 256
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("tunnel: 2d context unavailable")
  ctx.fillStyle = "#0a0c12"
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = "#f4f4f4"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  let fontSize = height * 0.85
  ctx.font = `${fontSize}px ${FONT_FAMILY}, sans-serif`
  const maxTextWidth = width * 0.88
  const measured = ctx.measureText(TEXT).width
  if (measured > maxTextWidth) {
    fontSize *= maxTextWidth / measured
    ctx.font = `${fontSize}px ${FONT_FAMILY}, sans-serif`
  }
  ctx.fillText(TEXT, width / 2, height / 2)
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(TEXTURE_REPEAT_U, TEXTURE_REPEAT_V)
  texture.anisotropy = 16
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

// Build a closed-loop curve roughly in the XZ plane with smooth wobble.
// Wobble harmonics use integer multiples of the loop angle so the curve
// joins seamlessly at t=1 → t=0.
function buildLoopCurve(): THREE.CatmullRomCurve3 {
  const points: THREE.Vector3[] = []
  const numPoints = 32
  const baseRadius = 70
  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2
    const radialWobble = Math.sin(angle * 3) * 14 + Math.cos(angle * 5 + 1.1) * 6
    const r = baseRadius + radialWobble
    const x = Math.cos(angle) * r
    const z = Math.sin(angle) * r
    const y = Math.sin(angle * 4 + 0.7) * 10 + Math.cos(angle * 2 + 2.3) * 5
    points.push(new THREE.Vector3(x, y, z))
  }
  return new THREE.CatmullRomCurve3(points, true, "catmullrom", 0.5)
}

function Tunnel() {
  onMount(() => ensureTunnelFontLoaded())
  const three = useThree()

  const texture = createMemo(() => {
    tunnelFontReady() // track — rebuild texture once font lands
    const t = makeTextTexture()
    onCleanup(() => t.dispose())
    return t
  })

  const curve = buildLoopCurve()
  const geometry = new THREE.TubeGeometry(
    curve,
    TUBULAR_SEGMENTS,
    TUBE_RADIUS,
    RADIAL_SEGMENTS,
    true,
  )
  onCleanup(() => geometry.dispose())

  const material = createMemo(() => {
    const m = new THREE.MeshBasicMaterial({
      map: texture(),
      side: THREE.BackSide,
    })
    onCleanup(() => m.dispose())
    return m
  })

  const startTime = performance.now()
  const camPos = new THREE.Vector3()
  const lookTarget = new THREE.Vector3()
  const desiredQuat = new THREE.Quaternion()
  const tempMat = new THREE.Matrix4()
  // Smooth orientation toward the desired heading instead of snapping each
  // frame — kills head-snap motion sickness. Position stays glued to the
  // curve so the camera never leaves the tube interior.
  const ORIENTATION_LERP = 0.05
  const LOOK_AHEAD_T = 0.02
  let firstFrame = true

  useFrame(() => {
    const elapsed = (performance.now() - startTime) / 1000
    const t = (elapsed / LOOP_DURATION_SECONDS) % 1
    curve.getPointAt(t, camPos)
    curve.getPointAt((t + LOOK_AHEAD_T) % 1, lookTarget)
    three.camera.position.copy(camPos)
    tempMat.lookAt(camPos, lookTarget, three.camera.up)
    desiredQuat.setFromRotationMatrix(tempMat)
    if (firstFrame) {
      // Snap to the curve's heading on the first frame so the camera doesn't
      // appear to swing in from its default orientation.
      three.camera.quaternion.copy(desiredQuat)
      firstFrame = false
    } else {
      three.camera.quaternion.slerp(desiredQuat, ORIENTATION_LERP)
    }
  })

  return <T.Mesh geometry={geometry} material={material()} />
}

export default function TunnelDemo() {
  return (
    <Canvas camera={{ fov: 78, near: 0.01, far: 400 }}>
      <T.Color attach="background" args={["#0a0c12"]} />
      <Tunnel />
    </Canvas>
  )
}
