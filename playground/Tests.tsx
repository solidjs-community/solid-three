import { Primitive, T, useFrame, useLoader } from '@src'
import { For, JSX, Match, Show, Switch, createSignal, onCleanup, onMount } from 'solid-js'
import { Portal } from 'solid-js/web'
import * as THREE from 'three'
import { Mesh } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { Box } from './components/Box'
import { Sphere } from './components/Sphere'

const Slot = (props: { children: JSX.Element }) => (
  <Portal>
    <div style={{ position: 'fixed', bottom: '10px', left: '50%', transform: 'translateX(-50%)' }}>
      {props.children}
    </div>
  </Portal>
)

export default {
  Hover: () => {
    let mesh: Mesh | undefined
    const [hovered, setHovered] = createSignal(false)
    useFrame(() => {
      mesh!.rotation.y += 0.01
    })

    return (
      <>
        <Slot>{hovered() ? 'hovered' : 'not hovered'}</Slot>
        <Box
          onPointerEnter={(e) => setHovered(true)}
          onPointerLeave={(e) => setHovered(false)}
          ref={mesh}
          color={hovered() ? 'green' : 'red'}
        />
      </>
    )
  },
  Show: () => {
    const [visible, setVisible] = createSignal(false)
    const interval = setInterval(() => setVisible((visible) => !visible), 1000)
    onCleanup(() => clearInterval(interval))
    return (
      <>
        <Slot>{visible() ? 'visible' : 'hidden'}</Slot>
        <Show when={visible()}>
          <Box />
        </Show>
      </>
    )
  },
  Match: () => {
    const [shape, setShape] = createSignal<'cube' | 'sphere'>('cube')
    setTimeout(() => setShape('sphere'), 2000)
    const interval = setInterval(() => setShape((shape) => (shape === 'cube' ? 'sphere' : 'cube')), 1000)
    onCleanup(() => clearInterval(interval))
    return (
      <>
        <Slot>{shape()}</Slot>
        <Switch>
          <Match when={shape() === 'cube'}>
            <Box />
          </Match>
          <Match when={shape() === 'sphere'}>
            <Sphere />
          </Match>
        </Switch>
      </>
    )
  },
  Loader: () => {
    const gltf = useLoader(GLTFLoader, '/assets/gltf/DamagedHelmet/glTF/DamagedHelmet.gltf')
    return (
      <>
        <Slot>{gltf.state}</Slot>
        <T.Group scale={[2, 2, 2]}>
          <Primitive object={gltf()?.scene} />
        </T.Group>
      </>
    )
  },
  Texture: () => {
    const colorMap = useLoader(THREE.TextureLoader, 'assets/img/stone.jpg')
    return (
      <>
        <Slot>{colorMap.state}</Slot>
        <T.Mesh>
          <T.SphereGeometry />
          <T.MeshStandardMaterial roughness={0} map={colorMap?.() ?? new THREE.Texture()} />
        </T.Mesh>
      </>
    )
  },
  Transparent: () => {
    const [transparent, setTransparent] = createSignal(false)
    const interval = setInterval(() => setTransparent((transparent) => !transparent), 1000)
    onCleanup(() => clearInterval(interval))
    return (
      <>
        <Slot>{transparent() ? 'transparent' : 'not transparent'}</Slot>
        <T.Mesh>
          <T.SphereGeometry />
          <T.MeshStandardMaterial transparent={transparent()} opacity={0.5} />
        </T.Mesh>
      </>
    )
  },
  Parenting: () => {
    const HoverBox = (props: { children?: JSX.Element; position?: [number, number, number] }) => {
      let mesh: Mesh | undefined
      const [hovered, setHovered] = createSignal(false)
      useFrame(() => {
        mesh!.rotation.y += 0.01
      })
      return (
        <Box
          onPointerEnter={(e) => {
            e.stopPropagation()
            setHovered(true)
          }}
          onPointerLeave={(e) => {
            e.stopPropagation()
            setHovered(false)
          }}
          ref={mesh}
          position={props.position}
          color={hovered() ? 'green' : 'red'}>
          {props.children}
        </Box>
      )
    }
    return (
      <HoverBox>
        <HoverBox position={[0, 0, 2]} />
      </HoverBox>
    )
  },
  For: () => {
    const [amount, setAmount] = createSignal(2)
    return (
      <>
        <Slot>
          <input type="number" value={amount()} onInput={(e) => setAmount(+e.currentTarget.value)}></input>
        </Slot>
        <For each={new Array(amount())}>
          {(_, x) => (
            <For each={new Array(amount())}>
              {(_, y) => (
                <For each={new Array(amount())}>
                  {(_, z) => (
                    <Box position={[x() * 2 - amount() / 2, y() * 2 - amount() / 2, z() * 2 - amount() / 2]} />
                  )}
                </For>
              )}
            </For>
          )}
        </For>
      </>
    )
  },
  Line: () => {
    let geometry
    let line
    let drawCount = 0
    const MAX_POINTS = 100

    // update positions
    function updatePositions() {
      const positions = line.geometry.attributes.position.array

      let x, y, z, index
      x = y = z = index = 0

      for (let i = 0, l = MAX_POINTS; i < l; i++) {
        positions[index++] = x
        positions[index++] = y
        positions[index++] = z

        x += (Math.random() - 0.5) * 1
        y += (Math.random() - 0.5) * 1
        z += (Math.random() - 0.5) * 1
      }
    }

    onMount(() => {
      // attributes
      const positions = new Float32Array(MAX_POINTS * 3)
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

      // drawcalls
      drawCount = 2
      geometry.setDrawRange(0, drawCount)

      updatePositions()
      geometry.attributes.position.needsUpdate = true

      useFrame(() => {
        drawCount = (drawCount + 1) % MAX_POINTS

        geometry.setDrawRange(0, drawCount)

        if (drawCount === 0) {
          updatePositions()
          geometry.attributes.position.needsUpdate = true
          line.material.color.setHSL(Math.random(), 1, 0.5)
        }
      })
    })

    return (
      <T.Line ref={line}>
        <T.BufferGeometry ref={geometry} />
        <T.LineBasicMaterial attach="material" color={'#9c88ff'} linecap={'round'} linejoin={'round'} />
      </T.Line>
    )
  },
}
