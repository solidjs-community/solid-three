import "./index.css";
import { createSignal } from "solid-js";
import * as THREE from "three";
import { Canvas, T, extend, useFrame } from "../src/index.ts";

extend(THREE);

function Box() {
  const mesh = new THREE.Mesh();
  const [hovered, setHovered] = createSignal(false);

  useFrame(() => (mesh!.rotation.y += 0.01));

  return (
    <>
      <T.Primitive
        object={mesh}
        onPointerEnter={e => setHovered(true)}
        onPointerLeave={e => setHovered(false)}
      >
        <T.BoxGeometry />
        <T.MeshStandardMaterial color={hovered() ? "green" : "red"} />
      </T.Primitive>
    </>
  );
}

export function App() {
  return (
    <Canvas
      style={{ width: "100vw", height: "100vh" }}
      camera={{ position: new THREE.Vector3(0, 0, 5) }}
    >
      <T.AmbientLight color={[0.2, 0.2, 0.2]} />
      <T.PointLight intensity={1.2} decay={1} position={[2, 2, 5]} rotation={[0, Math.PI / 3, 0]} />
      <Box />
      <T.ExtrudeGeometry args={[[new THREE.Shape()]]} />
    </Canvas>
  );
}
