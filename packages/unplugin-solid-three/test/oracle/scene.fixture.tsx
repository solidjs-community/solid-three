import * as THREE from "three"
import { createT } from "solid-three"

const T = createT(THREE)

// Imported and mounted by oracle.test.tsx inside a real <Canvas> (via the
// solid-three test harness). The analyzer (global-setup) reads this same file
// and must narrow the catalogue to exactly the members accessed here.
export function Scene() {
  return (
    <T.Mesh>
      <T.BoxGeometry />
      <T.MeshNormalMaterial />
    </T.Mesh>
  )
}
