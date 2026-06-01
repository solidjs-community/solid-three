import { build, type Plugin, type UserConfig } from "vite"
import { analyzeModule } from "./analyze.ts"
import { enumerateNamespaceKeys } from "./namespace-keys.ts"
import { keyUniverse } from "./providers.ts"
import { rewriteEmit, rewriteMeasure } from "./rewrite.ts"
import { decodeScaffoldId, encodeScaffoldId, isScaffoldId, scaffoldSource } from "./scaffold.ts"

// Module-level coordination between the real build and its nested measure build.
// NOTE: this couples a build to its nested measure build by process-global state,
// so only one build may run per process at a time. Vite builds are sequential by
// default; do not run concurrent builds (e.g. parallel multi-config) in one process.
let measuring = false
// moduleId -> siteIndex -> used keys (filled by the measure build, read by the real build).
const measured = new Map<string, Map<number, Set<string>>>()
// moduleId -> siteIndex -> scaffold key universe (filled during the measure transform, read by load()).
const scaffoldKeys = new Map<string, Map<number, string[]>>()

// Public specifier emitted into source (no NUL). resolveId maps it to the internal "\0..." id.
const PUBLIC_PREFIX = "vps3-scaffold:"

function normalize(id: string): string {
  return id.split("?")[0].split("#")[0]
}

/** The specifier emitted into source (drops the leading NUL of the internal scaffold id). */
function publicScaffoldId(moduleId: string, siteIndex: number): string {
  return encodeScaffoldId(moduleId, siteIndex).slice(1)
}

export default function solidThree(): Plugin {
  let userConfig: UserConfig = {}
  let root = process.cwd()

  return {
    name: "vite-plugin-solid-three",
    enforce: "pre",
    apply: "build", // dev keeps the runtime proxy

    config(config) {
      userConfig = config
    },
    configResolved(resolved) {
      root = resolved.root
    },

    async buildStart() {
      if (measuring) return // we ARE the measurement build — don't recurse
      // Fresh state for this build (clears anything left by a prior build in the process).
      measured.clear()
      scaffoldKeys.clear()
      measuring = true
      try {
        // Replay the user's config (including their plugins — e.g. vite-plugin-solid,
        // which the measure build needs to transform JSX) so the measurement graph
        // matches the real one. Side effect: the user's plugins run a second time;
        // plugins with their own build-side effects will fire twice during a build.
        await build({
          ...userConfig,
          configFile: false,
          logLevel: "silent",
          build: { ...userConfig.build, write: false },
        })
      } finally {
        measuring = false
      }
    },

    resolveId(id) {
      if (id.startsWith(PUBLIC_PREFIX)) return "\0" + id
      return null
    },
    load(id) {
      if (!isScaffoldId(id)) return null
      const { moduleId, siteIndex } = decodeScaffoldId(id)
      const keys = scaffoldKeys.get(moduleId)?.get(siteIndex) ?? []
      return scaffoldSource(keys)
    },

    async transform(code, id) {
      const file = normalize(id)
      const { sites } = analyzeModule(code, file)
      if (sites.length === 0) return null

      if (measuring) {
        // Pass 1: build scaffold key universes, rewrite bindings to namespace imports.
        const perSite = new Map<number, string[]>()
        for (const site of sites) {
          const nsKeys = new Map<string, string[]>()
          for (const s of site.sources) {
            if (s.kind === "namespace") nsKeys.set(s.moduleId, await enumerateNamespaceKeys(s.moduleId, root))
          }
          perSite.set(site.siteIndex, [...keyUniverse(site.sources, nsKeys)])
        }
        scaffoldKeys.set(file, perSite)
        const result = rewriteMeasure(code, sites, site => publicScaffoldId(file, site.siteIndex))
        return { code: result.code, map: result.map }
      }

      // Pass 2 (real build): narrow using the measured used-keys.
      const used = measured.get(file)
      if (!used) return null
      const nsKeys = new Map<string, string[]>()
      for (const site of sites)
        for (const s of site.sources)
          if (s.kind === "namespace" && !nsKeys.has(s.moduleId))
            nsKeys.set(s.moduleId, await enumerateNamespaceKeys(s.moduleId, root))
      const result = rewriteEmit(code, sites, site => used.get(site.siteIndex) ?? new Set(), nsKeys)
      return { code: result.code, map: result.map }
    },

    generateBundle(_opts, bundle) {
      if (!measuring) return // only the measure build records usage
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== "chunk") continue
        for (const [mid, mod] of Object.entries(chunk.modules)) {
          if (!isScaffoldId(mid)) continue
          const { moduleId, siteIndex } = decodeScaffoldId(mid)
          const perSite = measured.get(moduleId) ?? new Map<number, Set<string>>()
          perSite.set(siteIndex, new Set(mod.renderedExports ?? []))
          measured.set(moduleId, perSite)
        }
      }
    },
  }
}
