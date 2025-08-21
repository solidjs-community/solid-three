import { Raycaster, Vector2 } from "three"
import type { Context } from "./types"

type RayEvent = PointerEvent | MouseEvent | WheelEvent

export interface EventRaycaster extends Raycaster {
  update(event: RayEvent, context: Context): void
}

export class CursorRaycaster extends Raycaster implements EventRaycaster {
  pointer = new Vector2()
  update(event: RayEvent, context: Context) {
    this.pointer.x = (event.offsetX / context.bounds.width) * 2 - 1
    this.pointer.y = -(event.offsetY / context.bounds.height) * 2 + 1
    this.setFromCamera(this.pointer, context.camera)
  }
}

export class CenterRaycaster extends Raycaster implements EventRaycaster {
  pointer = new Vector2()
  update(event: RayEvent, context: Context) {
    const offsetX = context.bounds.width / 2
    const offsetY = context.bounds.height / 2
    this.pointer.set(
      (offsetX / context.bounds.width) * 2 - 1,
      -(offsetY / context.bounds.height) * 2 + 1,
    )
    this.setFromCamera(this.pointer, context.camera)
  }
}
