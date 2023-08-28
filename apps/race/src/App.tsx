import { For, Index, Show, createEffect, createSignal, on, type Component, type JSX } from 'solid-js'

import {
  Box,
  Circle,
  Cone,
  Cylinder,
  KeyboardControls,
  OrbitControls,
  PerspectiveCamera,
  Sphere,
  Tube,
  useKeyboardControls,
} from '@solid-three/drei'
import { Canvas, T, Vector3, useFrame } from '@solid-three/fiber'
import { extend } from 'colord'
import namesPlugin from 'colord/plugins/names'
import * as THREE from 'three'
extend([namesPlugin])
THREE

export const SIZE = 2
export const AMOUNT = 8
const DEBUG = false
export const DELAY = 125

type ValueOfObject<T> = T[keyof T]
type ValueOfArray<T extends readonly any[]> = T[number]
export type Matrix<T> = T[][]
export type Vector = [row: number, column: number]

const wait = (delay = 1000) => new Promise((resolve) => setTimeout(resolve, delay))

const Mountain = (props: { position: Vector3 }) => {
  const grey = Math.random() * 0.4 + 0.2
  return <Cone args={[100, 250]} scale={Math.random()} position={props.position} material-color={[grey, grey, grey]} />
}

const Tree = (props: { position: Vector3 }) => {
  const randomWidth = Math.random() * 0.3
  const randomHeight = Math.random() * 0.3
  const randomScale = Math.random() * 2 + 4

  const randomColor = Math.floor(Math.random() * 40 - 20) / 250

  return (
    <T.Group position={props.position}>
      <Cylinder position={[0, 1, 0]} args={[0.4, 0.5, 2]} material-color="brown" />
      <T.Group position={[0, 5, 0]} scale={randomScale}>
        <Index each={new Array(4)}>
          {(_, i) => (
            <Cone
              args={[1 + randomWidth, 1.5 + randomHeight]}
              material-color={new THREE.Color(2 / 250 + randomColor, 48 / 250 + randomColor, 32 / 250 + randomColor)}
              position={[0, i / 2, 0]}
              scale={1 - i * 0.1}
            />
          )}
        </Index>
      </T.Group>
    </T.Group>
  )
}

const Car = (props: {
  speed?: number
  lateral: number
  curve: THREE.CatmullRomCurve3
  offset: number
  children?: JSX.Element
  color?: string
}) => {
  const Wheel = (props: { position: [number, number, number] }) => {
    return (
      <Cylinder rotation={[0, 0, Math.PI / 2]} args={[0.5, 0.5, 0.5]} position={props.position}>
        <T.MeshBasicMaterial attach="material" color="blue" />
      </Cylinder>
    )
  }

  const [rotation, setRotation] = createSignal(new THREE.Euler(), { equals: false })
  const [position, setPosition] = createSignal(new THREE.Vector3(), { equals: false })
  const [ratio, setRatio] = createSignal(props.offset)

  const [targetContainerPosition, setTargetContainerPosition] = createSignal(new THREE.Vector3(), { equals: false })

  const [cameraPosition, setCameraPosition] = createSignal(new THREE.Vector3(), { equals: false })
  const [cameraPositionSmoothed, setCameraPositionSmoothed] = createSignal(new THREE.Vector3())
  const [cameraRotation, setCameraRotation] = createSignal(new THREE.Euler(), { equals: false })
  const [cameraDirectionVector, setCameraDirectionVector] = createSignal(new THREE.Vector3(), { equals: false })
  const cameraTargetRatio = () => (ratio() + 0.1) % 1
  const carTargetRatio = () => (ratio() + 0.06) % 1

  let car: THREE.Group
  let target: THREE.Group

  const carPosition = new THREE.Vector3()
  // const cameraTargetPosition = new THREE.Vector3()
  const carDirectionVector = new THREE.Vector3()

  const tangent = new THREE.Vector3()
  const matrix = new THREE.Matrix4()
  const [cameraTargetPosition, setCameraTargetPosition] = createSignal(new THREE.Vector3(), { equals: false })
  createEffect(
    on(
      () => [props.curve, ratio()],
      () => {
        setTargetContainerPosition(props.curve.getPointAt(cameraTargetRatio(), targetContainerPosition()))
        setPosition(props.curve.getPointAt(ratio(), position()))

        car.getWorldPosition(carPosition)

        props.curve.getTangentAt(ratio(), tangent)
        matrix.lookAt(tangent, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0))
        setRotation((direction) => direction.setFromRotationMatrix(matrix))

        setCameraTargetPosition(props.curve.getPointAt(cameraTargetRatio(), cameraTargetPosition()))

        setCameraDirectionVector(cameraDirectionVector().subVectors(cameraTargetPosition(), carPosition))
        matrix.lookAt(new THREE.Vector3(0, 0, 0), cameraDirectionVector(), new THREE.Vector3(0, 1, 0))
        setCameraRotation((rotation) => rotation.setFromRotationMatrix(matrix))
        setCameraPosition((cameraPosition) => cameraPosition.addVectors(carPosition, cameraDirectionVector().negate()))
        if (!cameraPositionSmoothed) setCameraPositionSmoothed((c) => c.copy(cameraPosition()))
      },
    ),
  )

  useFrame(() => {
    setRatio((r) => (r + (props.speed || 1) * 0.001) % 1)
    setCameraPositionSmoothed((c) => c.setScalar(0.9).addScaledVector(cameraPosition(), 0.1))
  })

  return (
    <>
      <T.Group position={cameraPosition()} rotation={cameraRotation()}>
        {props.children}
      </T.Group>
      <T.Group position={cameraTargetPosition()}>
        <T.Group position={[props.lateral * 12 - 6, 0, 0]} ref={target!} />
      </T.Group>
      <T.Box3></T.Box3>
      <T.Group position={position()} rotation={rotation()}>
        <T.Group position={[props.lateral * 12 - 6, 0, 0]} ref={car!}>
          <Box scale={[1.5, 1, 3]}>
            <T.MeshBasicMaterial attach="material" color={props.color || 'red'} />
          </Box>
          <Cylinder rotation={[Math.PI / 2, 0, 0]} args={[0.5, 0.5, 1]} position={[0, 0.5, -0.45]}>
            <T.MeshBasicMaterial attach="material" color="pink" />
          </Cylinder>

          <Wheel position={[1, -0.25, -1]} />
          <Wheel position={[-1, -0.25, -1]} />
          <Wheel position={[1, -0.25, 1]} />
          <Wheel position={[-1, -0.25, 1]} />
        </T.Group>
      </T.Group>
    </>
  )
}

const Cloud = (props: { position: [number, number, number] }) => {
  const radius = 40
  const getPosition = () =>
    [Math.random() * radius, Math.random() * radius, Math.random() * radius] as [number, number, number]

  const [offset, setOffset] = createSignal(0)

  useFrame(() => setOffset((o) => o + 0.1 + 1 / props.position[2]))

  const position = () =>
    [props.position[0] + (offset() % 250), props.position[1], props.position[2]] as [number, number, number]

  const clouds = (
    <For each={new Array(20)}>{() => <Sphere position={getPosition()} scale={(Math.random() * radius) / 2 + 1} />}</For>
  )

  return <T.Group position={position()}>{clouds}</T.Group>
}

const App: Component = () => {
  const [lateral, setLateral] = createSignal(0.5)

  const right = useKeyboardControls<KeyboardControls>((state) => state.Left)
  const left = useKeyboardControls<KeyboardControls>((state) => state.Right)

  let camera

  createEffect(on(left, (left) => left && useFrame(() => setLateral((l) => Math.max(l - 0.01, 0)))))
  createEffect(on(right, (right) => right && useFrame(() => setLateral((l) => Math.min(l + 0.01, 1)))))

  let curve

  createEffect(() => console.log(lateral()))

  return (
    <>
      <For each={new Array(40)}>
        {() => {
          const position = [Math.random() * 1000 - 500, 100 + Math.random() * 100, Math.random() * 1000 - 500] as [
            number,
            number,
            number,
          ]
          return <Cloud position={position} />
        }}
      </For>

      <For each={new Array(40)}>
        {() => {
          const random = Math.random() * 360
          const random2 = Math.random() * 400
          const position = [Math.sin(random) * (150 + random2), 0, Math.cos(random) * (150 + random2)] as Vector3
          return <Mountain position={position} />
        }}
      </For>

      <For each={new Array(100)}>
        {() => {
          const random = Math.random() * 360
          const random2 = Math.random() * 200
          const position = [Math.sin(random) * (75 + random2), 0, Math.cos(random) * (75 + random2)] as Vector3
          return <Tree position={position} />
        }}
      </For>
      <T.EllipseCurve ref={curve} args={[0, 0, 10, 10, 0, 2 * Math.PI, false, 0]} />
      <T.CatmullRomCurve3
        ref={curve}
        points={[
          new THREE.Vector3(0, 0, 40),
          new THREE.Vector3(20, 0, 40),
          new THREE.Vector3(35, 0, 35),
          new THREE.Vector3(40, 0, 20),
          new THREE.Vector3(40, 0, 0),
          new THREE.Vector3(40, 0, -20),
          new THREE.Vector3(35, 0, -35),
          new THREE.Vector3(20, 0, -40),
          new THREE.Vector3(0, 0, -40),
          new THREE.Vector3(-20, 0, -40),
          new THREE.Vector3(-35, 0, -35),
          new THREE.Vector3(-40, 0, -20),
          new THREE.Vector3(-40, 0, 0),
          new THREE.Vector3(-40, 0, 20),
          new THREE.Vector3(-35, 0, 35),
          new THREE.Vector3(-20, 0, 40),
          new THREE.Vector3(0, 0, 40),
        ]}
      />
      <Tube scale={[1, 0.01, 1]} args={[curve, 100, 8, 100, true]} />
      <Circle scale={1000} rotation-x={-Math.PI / 2} material-color="green" />
      <Show when={DEBUG}>
        <OrbitControls />
        <PerspectiveCamera fov={45} makeDefault ref={camera} position={[0, 2, 0]} far={10000} />
      </Show>

      <T.Group position={[0, 0.75, 0]}>
        <Car curve={curve!} offset={0} lateral={lateral()}>
          <Show when={!DEBUG}>
            <PerspectiveCamera fov={45} makeDefault ref={camera} position={[0, 2, 0]} far={10000} />
          </Show>
        </Car>
        <Car speed={0.7} color="green" curve={curve!} offset={0.125} lateral={Math.random()} />
        <Car speed={0.75} color="yellow" curve={curve!} offset={0.25} lateral={Math.random()} />
        <Car speed={0.9} color="pink" curve={curve!} offset={0.375} lateral={Math.random()} />
        <Car speed={0.8} color="purple" curve={curve!} offset={0.5} lateral={Math.random()} />
      </T.Group>

      <Sphere material-color="yellow" scale={1000} position={[0, 250, 750]} />
      <T.Color attach="background" args={['blue']} />
    </>
  )
}

const keyboardMap = [
  { name: 'Drop', keys: ['Space'] },
  { name: 'Rotate', keys: ['ArrowUp', 'KeyW'] },
  { name: 'Switch', keys: ['Enter'] },
  { name: 'Left', keys: ['ArrowLeft', 'KeyW'] },
  { name: 'Right', keys: ['ArrowRight', 'KeyD'] },
  { name: 'Down', keys: ['ArrowDown', 'KeyS'] },
] as const
type KeyboardControls = (typeof keyboardMap)[number]['name']

export default () => (
  <KeyboardControls map={keyboardMap}>
    <Canvas style={{ width: '100vw', height: '100vh' }}>
      <App />
    </Canvas>
  </KeyboardControls>
)
