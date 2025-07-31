import { Accessor, Setter, createSignal, getOwner, onCleanup, untrack } from "solid-js";

/** Class representing a stack data structure. */
export class Stack<T = any> {
  #array: Accessor<(T | Accessor<T>)[]>;
  #setArray: Setter<(T | Accessor<T>)[]>;
  constructor(public name: string) {
    [this.#array, this.#setArray] = createSignal<(T | Accessor<T>)[]>([], { equals: false });
  }
  /**
   * Returns the complete stack.
   * @returns Returns the complete stack.
   */
  all() {
    return this.#array();
  }
  /**
   * Returns the top element of the stack without removing it.
   * @returns The top element of the stack.
   */
  peek(): T | undefined {
    const array = this.#array();
    const top = array[array.length - 1];
    return typeof top === "function" ? (top as Accessor<T>)() : top;
  }
  /**
   * Adds a value `T` or `Accessor<T>` to the stack.
   * Value is automatically removed from stack on cleanup.
   * @param value - The value to add to the stack.
   * @returns A cleanup function to remove the value from the stack.
   */
  push(value: T | Accessor<T>) {
    this.#setArray(array => {
      const index = array.indexOf(value);
      if (index !== -1) array.splice(index, 1);
      array.push(value);
      return array;
    });
    if (import.meta.env?.MODE === "development") {
      const array = untrack(this.#array.bind(this));
      if (array.length > 2) {
        // TODO: write better warning message
        console.warn(
          `Stack ${this.name} has more then 2 entries:`,
          array,
          `This could lead to unexpected behavior: only the latest added value will be selected.`,
        );
      }
      if (getOwner() === null) {
        console.warn(
          `Value ${value} is added to stack ${this.name} outside a \`createRoot\` or \`render\`.
Remember to remove the element from the stack by calling the returned cleanup-function manually.`,
        );
      }
    }
    onCleanup(() => this.remove(value));
    return () => this.remove(value);
  }
  /**
   * Removes a value from the stack.
   * @private
   * @param value - The value to remove from the stack.
   */
  remove(value: T | Accessor<T>) {
    this.#setArray(array => {
      const index = array.indexOf(value);
      if (index === -1) return array;
      array.splice(index, 1);
      return array;
    });
  }
}
