import { Canvas, useFrame } from "solid-three";
import { createSignal, Show } from "solid-js";
import { OrbitControls } from "src/components/OrbitControls";

function Box(props: any) {
  const [hovered, setHover] = createSignal(false);
  const [rotation, setRotation] = createSignal(0.5);
  const [active, setActive] = createSignal(false);

  useFrame((s, delta) => setRotation((r) => r + 0.01));

  return (
    <mesh
      onClick={(e) => setActive((t) => !t)}
      onPointerOver={(e) => setHover(true)}
      onPointerOut={(e) => setHover(false)}
      rotation-y={rotation()}
      scale={active() ? 1.5 : 1}
      {...props}
    >
      <boxBufferGeometry />
      <meshStandardMaterial color={hovered() ? "hotpink" : "orange"} />
    </mesh>
  );
}

export default function App() {
  return (
    <Canvas
      camera={{
        position: [0, 2, 5],
      }}
    >
      <ambientLight intensity={0.5} />
      <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} />
      <pointLight position={[-10, -10, -10]} />
      <Box position={[-1.2, 0, 0]} />
      <Box position={[1.2, 0, 0]} />
      <OrbitControls />
    </Canvas>
  );
}
