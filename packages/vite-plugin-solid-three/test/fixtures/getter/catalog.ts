import * as THREE from "three"
import { createT } from "solid-three"

class Custom {
  getterMarker() {}
}

export const T = createT({ ...THREE, get Special() { return Custom } })
