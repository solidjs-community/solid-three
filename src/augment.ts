import { $S3C } from "./constants.ts"
import type { Instance } from "./types"

/**
 * A utility to add metadata to a given instance.
 * This data can be accessed behind the `S3C` symbol and is used internally in `solid-three`.
 *
 * @param instance - `three` instance
 * @param augmentation - additional data: `{ props }`
 * @returns the `three` instance with the additional data
 */
export const augment = <T>(instance: T, augmentation = {}) => {
  if (instance && typeof instance === "object" && $S3C in instance) {
    return instance as Instance<T>
  }
  // @ts-expect-error TODO: fix type-error
  instance[$S3C] = { children: new Set(), ...augmentation }
  return instance as Instance<T>
}
