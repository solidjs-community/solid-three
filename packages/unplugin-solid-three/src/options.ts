export interface Options {
  /** Turn "could not narrow a namespace" warnings into a build error. */
  strict?: boolean
  /** Path to the tsconfig used to build the ts-morph Project. Auto-detected if omitted. */
  tsconfig?: string
}

export interface ResolvedOptions {
  strict: boolean
  tsconfig: string | undefined
}

export function resolveOptions(options: Options | undefined): ResolvedOptions {
  return {
    strict: options?.strict ?? false,
    tsconfig: options?.tsconfig,
  }
}
