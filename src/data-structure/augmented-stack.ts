import type { Accessor } from "solid-js"
import { SHOULD_DEBUG } from "../constants.ts"
import type { Meta } from "../types.ts"
import { createDebug, meta } from "../utils.ts"
import { Stack } from "./stack.ts"

const debugAugStack = createDebug("augmented-stack:AugmentedStack", SHOULD_DEBUG)

/** A generic stack data structure. It augments each value before pushing it onto the stack. */
export class AugmentedStack<T> {
  #stack = new Stack<Meta<T>>(null!)
  constructor(public name: string) {
    this.#stack.name = name
  }
  all = this.#stack.all.bind(this.#stack)
  peek = this.#stack.peek.bind(this.#stack)
  /**
   * Augments a value `T` or `Accessor<T>` and adds it to the stack.
   * Value is automatically removed from stack on cleanup.
   *
   * @param value - The value to add to the stack.
   * @returns A cleanup function to manually remove the value from the stack.
   */
  push(value: T | Accessor<T>) {
    if (typeof value === "function") {
      debugAugStack("push", { stack: this.name, via: "accessor" })
      return this.#stack.push(() => meta((value as Accessor<T>)()))
    }
    debugAugStack("push", { stack: this.name, via: "value" })
    return this.#stack.push(meta(value))
  }
}
