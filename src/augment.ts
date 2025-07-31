import { S3 } from ".";

export const $S3C = Symbol("solid-three");

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
    return instance as S3.Instance<T>;
  }
  instance[$S3C] = { children: new Set(), ...augmentation };
  return instance as S3.Instance<T>;
};
