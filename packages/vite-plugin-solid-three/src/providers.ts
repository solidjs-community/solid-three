import type { CatalogueSource } from "./types.ts"

type NsKeys = Map<string, string[]> // moduleId -> export names

export function keyUniverse(sources: CatalogueSource[], nsKeys: NsKeys): Set<string> {
  const keys = new Set<string>()
  for (const s of sources) {
    if (s.kind === "namespace") for (const k of nsKeys.get(s.moduleId) ?? []) keys.add(k)
    else keys.add(s.key)
  }
  return keys
}

/**
 * The provider for `key`, applying last-writer-wins over sources.
 * `verbatim` is true for a getter/method whose `text` is a whole object member
 * (it declares its own key, so emit must NOT prefix it with `key:`).
 */
export interface Provider {
  text: string
  verbatim: boolean
}

export function providerFor(key: string, sources: CatalogueSource[], nsKeys: NsKeys): Provider | undefined {
  for (let i = sources.length - 1; i >= 0; i--) {
    const s = sources[i]
    if (s.kind === "entry" && s.key === key) return { text: s.valueText, verbatim: s.verbatim ?? false }
    if (s.kind === "namespace" && (nsKeys.get(s.moduleId) ?? []).includes(key)) {
      return { text: `${s.localName}.${key}`, verbatim: false }
    }
  }
  return undefined
}
