import { Mesh } from "three";
import { Canvas, createSignal, useFrame } from "../src";

export function App() {
  return (
    <Canvas
      camera={{
        position: [3, 3, 3]
      }}
      gl={{
        antialias: true
      }}
    >
      <Box />
    </Canvas>
  );
}

function Box() {
  let mesh: Mesh | undefined;
  const [hovered, setHovered] = createSignal(false);

  useFrame(() => (mesh!.rotation.y += 0.01));

  return (
    <mesh ref={mesh} onPointerEnter={e => setHovered(true)} onPointerLeave={e => setHovered(false)}>
      <boxBufferGeometry />
      <meshStandardMaterial color={hovered() ? "blue" : "red"} />
      <ambientLight />
      <spotLight position={[0, 5, 10]} intensity={1} />
    </mesh>
  );
}
