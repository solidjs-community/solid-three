export declare type Mutable<T> = {
  -readonly [P in keyof T]: T[P]
}
export declare type Falsey = false | '' | 0 | null | undefined
