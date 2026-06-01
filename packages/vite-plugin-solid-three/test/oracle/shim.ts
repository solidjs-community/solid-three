// Instrumentation shim for the soundness oracle.
//
// `requestedKeys` records every catalogue property the running scene touches.
// `wrap` takes the real `createT` factory and returns a drop-in replacement
// that builds the real catalogue, then proxies the returned `T` object so each
// property access is logged before delegating to the real value.

export const requestedKeys = new Set<string>()

type CreateT = (catalogue: Record<string, unknown>) => Record<string, unknown>

export function wrap(realCreateT: CreateT): CreateT {
  return catalogue => {
    const real = realCreateT(catalogue)
    return new Proxy(real, {
      get(target, prop, receiver) {
        if (typeof prop === "string") {
          requestedKeys.add(prop)
        }
        return Reflect.get(target, prop, receiver)
      },
    })
  }
}
