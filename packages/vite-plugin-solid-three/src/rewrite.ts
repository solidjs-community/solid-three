import MagicString from "magic-string"
import { keyUniverse, providerFor } from "./providers.ts"
import type { CatalogueSite } from "./types.ts"

export interface RewriteResult {
  code: string
  map: ReturnType<MagicString["generateMap"]>
}

/** Pass 1: turn each catalogue binding into a namespace import of its scaffold. */
export function rewriteMeasure(
  code: string,
  sites: CatalogueSite[],
  scaffoldIdFor: (site: CatalogueSite) => string,
): RewriteResult {
  const s = new MagicString(code)
  for (const site of sites) {
    const reexport = site.exported ? `\nexport { ${site.binding} }` : ""
    s.overwrite(
      site.statementStart,
      site.statementEnd,
      `import * as ${site.binding} from "${scaffoldIdFor(site)}"${reexport}`,
    )
  }
  return { code: s.toString(), map: s.generateMap({ hires: true }) }
}

/** Pass 2: narrow each createT argument to the used keys, resolving providers. */
export function rewriteEmit(
  code: string,
  sites: CatalogueSite[],
  usedKeysFor: (site: CatalogueSite) => Set<string>,
  nsKeys: Map<string, string[]>,
): RewriteResult {
  const s = new MagicString(code)
  for (const site of sites) {
    const used = usedKeysFor(site)
    const universe = keyUniverse(site.sources, nsKeys)
    const entries: string[] = []
    for (const key of used) {
      if (!universe.has(key)) continue // accessed key not in catalogue — leave to runtime (proxy semantics)
      const provider = providerFor(key, site.sources, nsKeys)
      if (provider === undefined) continue
      // A verbatim member (getter/method) already declares its own key.
      entries.push(provider.verbatim ? provider.text : `${key}: ${provider.text}`)
    }
    s.overwrite(site.argStart, site.argEnd, `{ ${entries.join(", ")} }`)
  }
  return { code: s.toString(), map: s.generateMap({ hires: true }) }
}
