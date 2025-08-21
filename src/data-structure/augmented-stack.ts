import type { Accessor } from "solid-js"
import type { Meta } from "../types.ts"
import { meta } from "../utils.ts"
import { Stack } from "./stack.ts"

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
    const cleanup =
      typeof value === "function"
        ? this.#stack.push(() => meta((value as Accessor<T>)()))
        : this.#stack.push(meta(value))
    return cleanup
  }
}
