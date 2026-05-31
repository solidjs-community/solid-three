/** Keys requested of any wrapped T proxy during a render. */
export const requestedKeys = new Set<string>()

type CreateT = (catalogue: Record<string, unknown>) => Record<string, unknown>

/**
 * Wrap the real `createT` so every key requested of the resulting proxy is
 * recorded. The real factory is passed in (via vi.importOriginal) so this
 * never recurses through the mocked `solid-three` module.
 */
export function wrap(realCreateT: CreateT): CreateT {
  return catalogue => {
    const inner = realCreateT(catalogue)
    return new Proxy(inner, {
      get(target, prop) {
        if (typeof prop === "string") requestedKeys.add(prop)
        return (target as Record<string | symbol, unknown>)[prop]
      },
    })
  }
}
