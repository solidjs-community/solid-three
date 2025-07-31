import { createSignal } from "solid-js";
import { Mesh } from "three";
import { T, useFrame } from "../src";

export function Box() {
  let mesh: Mesh | undefined;
  const [hovered, setHovered] = createSignal(false);

  useFrame(() => (mesh!.rotation.y += 0.01));

  return (
    <>
      <T.Mesh
        ref={mesh}
        onPointerEnter={e => setHovered(true)}
        onPointerLeave={e => setHovered(false)}
      >
        <T.BoxGeometry />
        <T.MeshStandardMaterial color={hovered() ? "green" : "red"} />
      </T.Mesh>
    </>
  );
}
