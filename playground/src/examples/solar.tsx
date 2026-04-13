import { createEffect, createMemo, createSignal, Show, type ParentProps, type Ref } from "solid-js"
import * as THREE from "three"
import { Canvas, createT, Entity, useFrame } from "../../../src/index.ts"
import type { Meta } from "../../../src/types.ts"
import { OrbitControls } from "../../controls/orbit-controls.tsx"

const T = createT(THREE)

function OrbitPath(
  props: ParentProps<{
    ref?: Ref<THREE.Line>
    xRadius: number
    yRadius: number
    rotation?: [number, number, number]
  }>,
) {
  const curve = createMemo(() => {
    const ellipse = new THREE.EllipseCurve(
      0,
      0, // ax, aY
      props.xRadius,
      props.yRadius, // xRadius, yRadius
      0,
      Math.PI * 2, // aStartAngle, aEndAngle
      false, // aClockwise
      0, // aRotation
    )
    const points = ellipse.getPoints(64)
    const geometry = new THREE.BufferGeometry().setFromPoints(points)

    // Apply rotation if provided
    if (props.rotation) {
      geometry.rotateX(props.rotation[0])
      geometry.rotateY(props.rotation[1])
      geometry.rotateZ(props.rotation[2])
    }

    return geometry
  })

  return (
    <T.Line
      raycastable={false}
      ref={props.ref}
      onPointerMove={event => {
        event.stopPropagation()
      }}
    >
      <T.LineBasicMaterial color="#ffffff" />
      <Entity from={curve()} />
      {props.children}
    </T.Line>
  )
}

function CelestialBody(
  props: ParentProps<{
    ref?: Ref<THREE.Object3D>
    name: string
    radius: number
    color: string
    position?: [number, number, number]
    rotation?: [number, number, number]
    orbit?: [number, number]
    speed?: number
  }>,
) {
  const [hovered, setHovered] = createSignal(false)
  let ref: Meta<THREE.Mesh> = null!

  createEffect(
    () => props.orbit,
    orbit => {
      if (!orbit) return
      useFrame(state => {
        // Earth orbits around sun in an ellipse
        const time = state.clock.getElapsedTime()
        const [a, b] = orbit // semi-major axis

        ref.position.y = a * Math.cos(time * (props.speed ?? 0.25))
        ref.position.x = b * Math.sin(time * (props.speed ?? 0.25))
      })
    },
  )

  return (
    <>
      <Show when={props.orbit}>
        {orbit => (
          <OrbitPath
            xRadius={orbit()[0]}
            yRadius={orbit()[1]}
            rotation={[Math.PI, 0, Math.PI / 2]}
          />
        )}
      </Show>

      <T.Mesh
        ref={ref}
        position={props.position || [0, 0, 0]}
        rotation={props.rotation || [0, 0, 0]}
        onPointerDown={console.log}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
      >
        <T.SphereGeometry args={[props.radius, 32, 32]} />
        <T.MeshBasicMaterial color={props.color} />
        {props.children}
        {/* Outline sphere - only visible when hovered */}
        <Show when={hovered()}>
          <T.Mesh>
            <T.SphereGeometry args={[props.radius + 0.1, 32, 32]} />
            <T.MeshBasicMaterial color="red" side={THREE.BackSide} />
          </T.Mesh>
        </Show>
      </T.Mesh>
    </>
  )
}

export default function () {
  return (
    <Canvas
      defaultCamera={{ position: new THREE.Vector3(0, 0, 30) }}
      onClick={event => console.debug("canvas clicked", event)}
      onClickMissed={event => console.debug("canvas click missed", event)}
      onPointerLeave={event => console.debug("canvas pointer leave", event)}
      onPointerEnter={event => console.debug("canvas pointer enter", event)}
    >
      <OrbitControls />
      <T.AmbientLight intensity={0.2} />
      <T.PointLight position={[0, 0, 0]} intensity={2} />
      <T.Group rotation={[0, 0, Math.PI / 2]}>
        <CelestialBody name="sun" radius={1.5} color="#FDB813">
          <CelestialBody name="earth" radius={0.5} color="#1E90FF" orbit={[8, 6]}>
            <CelestialBody
              name="moon"
              radius={0.2}
              color="#C0C0C0"
              orbit={[1.5, 1.5]}
              speed={0.5}
            />
          </CelestialBody>
        </CelestialBody>
      </T.Group>
    </Canvas>
  )
}
