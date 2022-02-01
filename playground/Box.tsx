import { Mesh } from "three";
import { createSignal, useFrame } from "../src";

export function Box() {
  let mesh: Mesh | undefined;
  const [hovered, setHovered] = createSignal(false);

  useFrame(() => (mesh!.rotation.y += 0.01));

  return (
    <mesh
      ref={mesh}
      onPointerEnter={e => setHovered(true)}
      onPointerLeave={e => setHovered(false)}
    >
      <boxBufferGeometry />
      <meshStandardMaterial color={hovered() ? "blue" : "green"} />
    </mesh>
  );
}
