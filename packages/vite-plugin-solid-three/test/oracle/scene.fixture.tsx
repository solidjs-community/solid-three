import * as THREE from "three"
import { createT } from "solid-three"

const T = createT(THREE)

export function Scene() {
  return (
    <>
      <T.Mesh>
        <T.BoxGeometry />
        <T.MeshStandardMaterial />
      </T.Mesh>
      <T.Group />
    </>
  )
}
