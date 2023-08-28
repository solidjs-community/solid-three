import {
  Primitive,
  T,
  Portal as ThreePortal,
  createThreeResource,
  useFrame,
  useLoader,
  useThree,
} from '@solid-three/fiber'
import {
  Accessor,
  For,
  JSX,
  Match,
  Show,
  Switch,
  createEffect,
  createSignal,
  onCleanup,
  onMount,
  splitProps,
} from 'solid-js'
import { Portal } from 'solid-js/web'
import * as THREE from 'three'
import { Mesh } from 'three'
import { GLTFLoader, RGBELoader } from 'three-stdlib'

import {
  CameraControls,
  Caustics,
  CubeCamera,
  MeshRefractionMaterial,
  PerspectiveCamera,
  Plane,
  Point,
  PointMaterial,
  Points,
  useFBO,
  useGLTF,
} from '@solid-three/drei'
import { createStore } from 'solid-js/store'
import { Box } from './components/Box'
import { Sphere } from './components/Sphere'

const CenterSlot = (props: { children: JSX.Element }) => (
  <Portal>
    <div
      style={{ 'user-select': 'none', position: 'fixed', bottom: '10px', left: '50%', transform: 'translateX(-50%)' }}>
      {props.children}
    </div>
  </Portal>
)
const LeftSlot = (props: { children: JSX.Element }) => (
  <Portal>
    <div style={{ position: 'fixed', bottom: '10px', left: '10px', 'font-size': '10pt' }}>{props.children}</div>
  </Portal>
)
const RightSlot = (props: { children: JSX.Element }) => (
  <Portal>
    <div style={{ position: 'fixed', 'text-align': 'right', bottom: '10px', right: '10px', 'font-size': '10pt' }}>
      {props.children}
    </div>
  </Portal>
)

export default {
  EventSystem: () => {
    let mesh: Mesh | undefined
    const [color, setColor] = createSignal('red')
    const [type, _setType] = createSignal<string>()
    useFrame(() => {
      mesh!.rotation.y += 0.01
    })

    const [list, setList] = createStore({
      onPointerEnter: false,
      onPointerLeave: false,
      onPointerMove: false,
      onPointerDown: false,
      onPointerUp: false,
      onDoubleClick: false,
      onPointerOut: false,
      onWheel: false,
      onContextMenu: false,
    })

    const setType = (type: keyof typeof list) => {
      setList(type, true)
      _setType(type)
    }

    return (
      <>
        <LeftSlot>{type() || 'none'}</LeftSlot>
        <RightSlot>
          <For each={Object.entries(list)}>
            {([type, done]) => <div style={{ 'text-decoration': done ? 'line-through' : undefined }}>{type}</div>}
          </For>
        </RightSlot>
        <Box
          onPointerEnter={(e) => {
            setType('onPointerEnter')
            setColor('green')
          }}
          onPointerLeave={(e) => {
            setType('onPointerLeave')
            setColor('red')
          }}
          onPointerMove={(e) => setType('onPointerMove')}
          onPointerDown={(e) => {
            setType('onPointerDown')
            setColor('yellow')
          }}
          onPointerUp={(e) => {
            setType('onPointerUp')
            setColor('orange')
          }}
          onDoubleClick={(e) => {
            setType('onDoubleClick')
            setColor('purple')
          }}
          onPointerOut={(e) => setType('onPointerOut')}
          onWheel={(e) => {
            setType('onWheel')
            setColor('blue')
          }}
          onContextMenu={(e) => {
            setType('onContextMenu')
            setColor('pink')
          }}
          ref={mesh}
          color={color()}
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
        <CenterSlot>{visible() ? 'visible' : 'hidden'}</CenterSlot>
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
        <CenterSlot>{shape()}</CenterSlot>
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
        <CenterSlot>{gltf.state}</CenterSlot>
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
        <CenterSlot>{colorMap.state}</CenterSlot>
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
        <CenterSlot>{transparent() ? 'transparent' : 'not transparent'}</CenterSlot>
        <T.Mesh>
          <T.SphereGeometry />
          <T.MeshStandardMaterial transparent={transparent()} opacity={0.5} />
        </T.Mesh>
      </>
    )
  },
  Parenting: () => {
    const [shouldStopPropagation, setShouldStopPropagation] = createSignal(true)

    const HoverBox = (props: { name: string; children?: JSX.Element; position?: [number, number, number] }) => {
      let mesh: Mesh | undefined
      const [hovered, setHovered] = createSignal(false)
      useFrame(() => {
        mesh!.rotation.y += 0.01
      })
      const rotation = Math.random() * 100
      return (
        <Box
          name={props.name}
          onPointerEnter={(e) => {
            if (shouldStopPropagation()) e.stopPropagation()
            setHovered(true)
          }}
          onPointerLeave={(e) => {
            if (shouldStopPropagation()) e.stopPropagation()
            setHovered(false)
          }}
          rotation={[rotation, rotation, 0]}
          ref={mesh}
          position={props.position}
          color={hovered() ? 'green' : 'red'}>
          {props.children}
        </Box>
      )
    }
    return (
      <>
        <CenterSlot>
          <div style={{ display: 'flex', 'align-items': 'center' }}>
            <label for="stopPropagation">stopPropagation</label>
            <input
              id="stopPropagation"
              type="checkbox"
              checked={shouldStopPropagation()}
              onInput={(e) => setShouldStopPropagation(e.currentTarget.checked)}></input>
          </div>
        </CenterSlot>
        <HoverBox name="box-1">
          <HoverBox position={[0, 0, 2]} name="box-2">
            <HoverBox position={[0, 0, 2]} name="box-3"></HoverBox>
          </HoverBox>
        </HoverBox>
      </>
    )
  },
  For: () => {
    const [amount, setAmount] = createSignal(2)
    return (
      <>
        <CenterSlot>
          <input type="number" value={amount()} onInput={(e) => setAmount(+e.currentTarget.value)}></input>
        </CenterSlot>
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
  RenderTarget: () => {
    // interpolated from https://codesandbox.io/s/r3f-render-target-qgcrx?file=/src/index.js:272-1652
    function SpinningThing() {
      let mesh: THREE.Mesh
      onMount(() => {
        useFrame(() => (mesh.rotation.x = mesh.rotation.y = mesh.rotation.z += 0.01))
      })
      return (
        <T.Mesh name="torus" ref={mesh!}>
          <T.TorusKnotGeometry />
          <T.MeshNormalMaterial attach="material" />
        </T.Mesh>
      )
    }

    function Cube() {
      let camera: THREE.PerspectiveCamera
      let material: THREE.MeshStandardMaterial

      const scene = new THREE.Scene()
      scene.name = 'NEW-SCENE'
      const target = new THREE.WebGLRenderTarget(1024, 1024, {
        stencilBuffer: false,
      })

      useFrame((state) => {
        camera.position.z = 5 + Math.sin(state.clock.getElapsedTime() * 1.5) * 2
        state.gl.setRenderTarget(target)
        state.gl.render(scene, camera)
        state.gl.setRenderTarget(null)
      })

      return (
        <>
          <T.PerspectiveCamera ref={camera!} position={[0, 0, 3]} />
          <ThreePortal container={scene}>
            <SpinningThing />
          </ThreePortal>
          <T.Mesh position={[1, 1, 1]}>
            <T.BoxGeometry />
            <T.MeshStandardMaterial ref={material!} attach="material" map={target.texture} />
          </T.Mesh>
        </>
      )
    }
    return (
      <>
        <T.AmbientLight />
        <T.SpotLight position={[10, 10, 10]} />
        <T.PointLight position={[-10, -10, -10]} color="red" />
        <Cube />
      </>
    )
  },
  Noop: () => {
    const box = <Box position={[0, 0, 0]} />
    return <CenterSlot>there should be no box</CenterSlot>
  },
  Reference: () => {
    const mesh = (
      <T.Mesh>
        <T.BoxGeometry />
        <T.MeshStandardMaterial />
      </T.Mesh>
    )
    useFrame(() => ((mesh as any as Accessor<THREE.Mesh>)().rotation.x += 0.1))
    return mesh
  },
  ReferenceComplex: () => {
    const [visible, setVisible] = createSignal(false)
    const interval = setInterval(() => setVisible((visible) => !visible), 1000)
    onCleanup(() => clearInterval(interval))

    const mesh = (
      <T.Mesh>
        <T.BoxGeometry />
        <T.MeshStandardMaterial />
      </T.Mesh>
    )

    useFrame(() => ((mesh as any as Accessor<THREE.Mesh>)().rotation.x += 0.1))

    return (
      <T.Group>
        <Show when={visible()}>{mesh}</Show>
      </T.Group>
    )
  },
  Suspense(props) {
    const Sibling = () => {
      const [resource] = createThreeResource(
        () => ['blue'],
        async ([key]) => {
          return new Promise<string>((resolve) => {
            console.log('fetch from sibling')
            setTimeout(() => {
              resolve(key)
            }, 2000)
          })
        },
      )
      return (
        <T.Suspense fallback={<Box color="red" />}>
          <Box color={resource()} />
        </T.Suspense>
      )
    }
    const Child = (props) => {
      const resource = useGLTF(
        'https://vazxmixjsiawhamofees.supabase.co/storage/v1/object/public/models/suzanne-high-poly/model.gltf',
      )
      return <Primitive object={resource()?.scene}>{props.children}</Primitive>
    }

    return (
      <T.Suspense fallback={<Box color="yellow" />}>
        <Child>
          <Sibling />
        </Child>
      </T.Suspense>
    )
  },
  CameraControl() {
    /**
     * we will render our scene in a render target and use it as a map.
     */
    const fbo = useFBO(400, 400)
    // let [virtualCamera, setVirtualCamera] = createSignal<CameraControls['camera']>() //:
    let virtualCamera
    let cameraControlRef: CameraControls | null
    const virtualScene = new THREE.Scene()

    useFrame(({ gl }) => {
      if (virtualCamera) {
        gl.setRenderTarget(fbo)
        gl.render(virtualScene, virtualCamera)

        gl.setRenderTarget(null)
      }
    })

    return (
      <>
        <ThreePortal container={virtualScene}>
          <Box onClick={() => cameraControlRef?.rotate(Math.PI / 4, 0, true)}>
            <T.MeshBasicMaterial />
          </Box>
          <PerspectiveCamera name="FBO Camera" ref={virtualCamera} position={[0, 0, 5]} />
          <CameraControls ref={cameraControlRef!} camera={virtualCamera} />
        </ThreePortal>
        <Plane args={[4, 4, 4]}>
          <T.MeshBasicMaterial map={fbo.texture} />
        </Plane>
      </>
    )
  },
  Points: () => {
    function PointEvent(_props) {
      const [props, rest] = splitProps(_props, ['color'])

      const [hovered, setHover] = createSignal(false)
      const [clicked, setClick] = createSignal(false)
      return (
        <Point
          {...rest}
          color={clicked() ? 'hotpink' : hovered() ? 'red' : props.color}
          onPointerOver={(e) => {
            console.log('over!')
            setHover(true)
          }}
          onPointerOut={(e) => setHover(false)}
          onClick={(e) => (e.stopPropagation(), setClick((state) => !state))}
        />
      )
    }
    const points = Array.from({ length: 100 }, (i) => [
      THREE.MathUtils.randFloatSpread(10),
      THREE.MathUtils.randFloatSpread(10),
      THREE.MathUtils.randFloatSpread(10),
    ])

    const store = useThree()

    createEffect(() => {
      if (store.raycaster.params.Points) {
        const old = store.raycaster.params.Points.threshold
        store.raycaster.params.Points.threshold = 0.175
        onCleanup(() => {
          if (store.raycaster.params.Points) store.raycaster.params.Points.threshold = old
        })
      }
    })

    return (
      <>
        <Points /* limit={points.length} range={points.length} */>
          <PointMaterial transparent vertexColors size={15} sizeAttenuation={false} depthWrite={false} />
          <For each={points}>{(position, i) => <PointEvent color="orange" position={position} />}</For>
        </Points>
      </>
    )
  },
  Diamond: () => {
    let ref
    const resource = useGLTF('assets/gltf/dflat.glb') as any
    // Use a custom envmap/scene-backdrop for the diamond material
    // This way we can have a clear BG while cube-cam can still film other objects
    const texture = useLoader(
      RGBELoader,
      'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/aerodynamics_workshop_1k.hdr',
    )

    return (
      <>
        <Show when={texture() && resource()}>
          <CubeCamera resolution={256} frames={1} /* envMap={texture()} */>
            {(texture) => (
              <>
                {() => console.log('this mounts!!', texture.format)}
                <Caustics
                  // @ts-ignore
                  backfaces
                  color="white"
                  position={[0, -0.5, 0]}
                  lightSource={[5, 5, -10]}
                  worldRadius={0.1}
                  ior={1.8}
                  backfaceIor={1.1}
                  intensity={0.1}>
                  <T.Mesh castShadow ref={ref} geometry={resource()?.nodes.Diamond_1_0.geometry}>
                    <MeshRefractionMaterial
                      envMap={texture}
                      bounces={3}
                      aberrationStrength={0.01}
                      ior={2.75}
                      fresnel={1}
                      fastChroma
                      toneMapped={false}
                    />
                  </T.Mesh>
                </Caustics>
              </>
            )}
          </CubeCamera>
        </Show>
      </>
    )
  },
}
