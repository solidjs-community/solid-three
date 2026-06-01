import * as THREE from "three"
import { createT } from "solid-three"
class CustomMesh {
  customMeshMarker() {}
}
export const T = createT({ ...THREE, Mesh: CustomMesh })
