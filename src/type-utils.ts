/** Generic constructor. Returns instance of given type. Defaults to any. */
export type Constructor<T = any> = new (...args: any[]) => T

/** Extracts the instance from a constructor. */
export type InstanceFromConstructor<TConstructor> =
  TConstructor extends Constructor<infer TObject> ? TObject : TConstructor

/** Omit function-properties from given type. */
type OmitFunctionProperties<T> = { [K in keyof T]: T[K] extends Function ? never : K }[keyof T]
/** Overwrites the properties in `T` with the properties from `O`. */
export type Overwrite<T, O> = Omit<T, OmitFunctionProperties<O>> & O

/**
 * Extracts the parameters of all possible overloads of a given constructor.
 *
 * @example
 * class Example {
 *   constructor(a: string);
 *   constructor(a: number, b: boolean);
 *   constructor(a: any, b?: any) {
 *     // Implementation
 *   }
 * }
 *
 * type ExampleParameters = ConstructorOverloadParameters<typeof Example>;
 * // ExampleParameters will be equivalent to: [string] | [number, boolean]
 */
export type ConstructorOverloadParameters<T extends Constructor> = T extends {
  new (...o: infer U): void
  new (...o: infer U2): void
  new (...o: infer U3): void
  new (...o: infer U4): void
  new (...o: infer U5): void
  new (...o: infer U6): void
  new (...o: infer U7): void
}
  ? U | U2 | U3 | U4 | U5 | U6 | U7
  : T extends {
        new (...o: infer U): void
        new (...o: infer U2): void
        new (...o: infer U3): void
        new (...o: infer U4): void
        new (...o: infer U5): void
        new (...o: infer U6): void
      }
    ? U | U2 | U3 | U4 | U5 | U6
    : T extends {
          new (...o: infer U): void
          new (...o: infer U2): void
          new (...o: infer U3): void
          new (...o: infer U4): void
          new (...o: infer U5): void
        }
      ? U | U2 | U3 | U4 | U5
      : T extends {
            new (...o: infer U): void
            new (...o: infer U2): void
            new (...o: infer U3): void
            new (...o: infer U4): void
          }
        ? U | U2 | U3 | U4
        : T extends {
              new (...o: infer U): void
              new (...o: infer U2): void
              new (...o: infer U3): void
            }
          ? U | U2 | U3
          : T extends {
                new (...o: infer U): void
                new (...o: infer U2): void
              }
            ? U | U2
            : T extends {
                  new (...o: infer U): void
                }
              ? U
              : never
