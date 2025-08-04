import { createSignal, type ParentProps } from "solid-js"
import * as THREE from "three"
import { Canvas, T, extend } from "../src/index.ts"
import "./index.css"

extend(THREE)

function Box(
  props: ParentProps<{
    name: string
    position: THREE.Vector3
    stopPropagation?: boolean
    noClick?: boolean
  }>,
) {
  const mesh = new THREE.Mesh()
  const [hovered, setHovered] = createSignal(false)

  //useFrame(() => (mesh!.rotation.y += 0.01))

  return (
    <>
      <T.Primitive
        object={mesh}
        position={props.position}
        onContextMenu={e => console.log("contextmenu", props.name, e)}
        onContextMenuMissed={e => console.log("contextmenu missed", props.name, e)}
        onPointerEnter={e => (console.log("enter", props.name, e), setHovered(true))}
        onPointerLeave={e => setHovered(false)}
        onPointerMove={e => console.log("move", props.name, e)}
        onClickMissed={e => console.log("click missed!", props.name, e)}
        onClick={
          !props.noClick
            ? event => {
                console.log("click", props.name)
                if (props.stopPropagation) {
                  event.stopPropagation()
                }
              }
            : undefined
        }
      >
        <T.BoxGeometry />
        <T.MeshBasicMaterial color={hovered() ? "green" : "red"} />
        {props.children}
      </T.Primitive>
    </>
  )
}

export function App() {
  return (
    <Canvas
      style={{ width: "100vw", height: "100vh" }}
      camera={{ position: new THREE.Vector3(0, 0, 10) }}
      onClick={event => console.log(event)}
    >
      <T.AmbientLight color={[0.2, 0.2, 0.2]} />
      <T.PointLight intensity={1.2} decay={1} position={[2, 2, 5]} rotation={[0, Math.PI / 3, 0]} />

      <Box name="1" position={new THREE.Vector3(0, 0, 0)}>
        <Box name="2" position={new THREE.Vector3(2, 0, 0)}>
          <Box name="3" position={new THREE.Vector3(2, 0, 0)} stopPropagation />
        </Box>
      </Box>
    </Canvas>
  )
}
