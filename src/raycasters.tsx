import { Quaternion, Raycaster, Vector2, Vector3, type Intersection, type Object3D } from "three"
import type { Context, Meta } from "./types.ts"
import { getMeta } from "./utils.ts"

const CENTER = new Vector2(0, 0)

export interface EventRaycaster extends Raycaster {
  /**
   * Aim this raycaster's ray for the current pointer, then intersect `registry`
   * (and its descendants, honoring `raycastable !== false`). The pointer system
   * calls this; how the ray is aimed is the subclass's business (camera + NDC
   * for screen pointers, `matrixWorld` for an XR controller).
   */
  cast(registry: Object3D[], context: Context): Intersection<Meta<Object3D>>[]
  /**
   * Position `this.ray` for the current pointer without intersecting anything —
   * the aiming half of `cast`. Pointer capture calls this to reproject the live
   * ray onto the captured object's plane.
   */
  aim(context: Context): void
}

/** Screen-ray family: aimed from a 2D cursor position in NDC. */
export interface ScreenRaycaster extends EventRaycaster {
  setCursor(ndc: Vector2): void
}

/**
 * Collect `registry` + all descendants that opt in to raycasting
 * (`raycastable !== false`), then intersect. Ported verbatim from the previous
 * `raycast` helper (minus the aim step, which each `cast` does itself).
 */
function castRegistry(raycaster: Raycaster, registry: Object3D[]): Intersection<Meta<Object3D>>[] {
  const nodeSet = new Set<Object3D>()
  const visitedSet = new Set<Object3D>()
  const stack = [...registry]

  for (const object of stack) {
    if (visitedSet.has(object)) continue
    visitedSet.add(object)

    const meta = getMeta(object)
    if (meta && meta.props.raycastable !== false) {
      nodeSet.add(object)
    }

    stack.push(...object.children)
  }

  return raycaster.intersectObjects(Array.from(nodeSet), false) as Intersection<Meta<Object3D>>[]
}

export class CursorRaycaster extends Raycaster implements ScreenRaycaster {
  pointer = new Vector2()
  setCursor(ndc: Vector2) {
    this.pointer.copy(ndc)
  }
  aim(context: Context) {
    this.setFromCamera(this.pointer, context.camera)
  }
  cast(registry: Object3D[], context: Context) {
    this.aim(context)
    return castRegistry(this, registry)
  }
}

export class CenterRaycaster extends Raycaster implements ScreenRaycaster {
  pointer = new Vector2(0, 0)
  setCursor(_ndc: Vector2) {
    /* centre is fixed — ignore the cursor */
  }
  aim(context: Context) {
    this.setFromCamera(CENTER, context.camera)
  }
  cast(registry: Object3D[], context: Context) {
    this.aim(context)
    return castRegistry(this, registry)
  }
}

/**
 * Casts from an `Object3D`'s world transform (origin = world position, direction
 * = its local -Z in world space) — the ray strategy for an XR controller.
 */
export class ControllerRaycaster extends Raycaster implements EventRaycaster {
  constructor(public space: Object3D) {
    super()
  }
  aim(_context: Context) {
    this.space.updateMatrixWorld()
    const origin = new Vector3().setFromMatrixPosition(this.space.matrixWorld)
    const direction = new Vector3(0, 0, -1)
      .applyQuaternion(new Quaternion().setFromRotationMatrix(this.space.matrixWorld))
      .normalize()
    this.ray.set(origin, direction)
  }
  cast(registry: Object3D[], context: Context) {
    this.aim(context)
    return castRegistry(this, registry)
  }
}
