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

/** The provider expression for `key`, applying last-writer-wins over sources. */
export function providerFor(key: string, sources: CatalogueSource[], nsKeys: NsKeys): string | undefined {
  for (let i = sources.length - 1; i >= 0; i--) {
    const s = sources[i]
    if (s.kind === "entry" && s.key === key) return s.valueText
    if (s.kind === "namespace" && (nsKeys.get(s.moduleId) ?? []).includes(key)) return `${s.localName}.${key}`
  }
  return undefined
}
