const PREFIX = "\0vps3-scaffold:"

export function scaffoldSource(keys: string[]): string {
  return keys.map(k => `export const ${k} = 0\n`).join("")
}

export function encodeScaffoldId(moduleId: string, siteIndex: number): string {
  return `${PREFIX}${siteIndex}:${encodeURIComponent(moduleId)}`
}

export function isScaffoldId(id: string): boolean {
  return id.startsWith(PREFIX)
}

export function decodeScaffoldId(id: string): { moduleId: string; siteIndex: number } {
  const rest = id.slice(PREFIX.length)
  const colon = rest.indexOf(":")
  return { siteIndex: Number(rest.slice(0, colon)), moduleId: decodeURIComponent(rest.slice(colon + 1)) }
}
