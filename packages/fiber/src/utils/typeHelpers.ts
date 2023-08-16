export type KeyOfOptionals<T> = keyof {
  [K in keyof T as T extends Record<K, T[K]> ? never : K]: T[K]
}

// from https://stackoverflow.com/questions/62118966/exclude-unknown-from-a-union-with-a-tuple
type ExcludeUnknown<T> = T extends Array<infer I> ? ({} extends I & {} ? never : T) : T

// interpolated from https://github.com/Microsoft/TypeScript/issues/26048
// handles up to 7 overloaded constructor parameters
export type AllConstructorParameters<T> = ExcludeUnknown<
  T extends {
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
>

// handles up to 7 overloaded parameters
export type AllParameters<T> = ExcludeUnknown<
  T extends {
    (...o: infer U): void
    (...o: infer U2): void
    (...o: infer U3): void
    (...o: infer U4): void
    (...o: infer U5): void
    (...o: infer U6): void
    (...o: infer U7): void
  }
    ? U | U2 | U3 | U4 | U5 | U6 | U7
    : T extends {
        (...o: infer U): void
        (...o: infer U2): void
        (...o: infer U3): void
        (...o: infer U4): void
        (...o: infer U5): void
        (...o: infer U6): void
      }
    ? U | U2 | U3 | U4 | U5 | U6
    : T extends {
        (...o: infer U): void
        (...o: infer U2): void
        (...o: infer U3): void
        (...o: infer U4): void
        (...o: infer U5): void
      }
    ? U | U2 | U3 | U4 | U5
    : T extends {
        (...o: infer U): void
        (...o: infer U2): void
        (...o: infer U3): void
        (...o: infer U4): void
      }
    ? U | U2 | U3 | U4
    : T extends {
        (...o: infer U): void
        (...o: infer U2): void
        (...o: infer U3): void
      }
    ? U | U2 | U3
    : T extends {
        (...o: infer U): void
        (...o: infer U2): void
      }
    ? U | U2
    : T extends {
        (...o: infer U): void
      }
    ? U
    : never
>

// from utility-helpers
export declare type Mutable<T> = {
  -readonly [P in keyof T]: T[P]
}
export declare type Falsey = false | '' | 0 | null | undefined
