import type { Component } from "solid-js"

const modules = import.meta.glob<{ default: Component }>("./*.tsx")
const sources = import.meta.glob("./*.tsx", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>

export interface Demo {
  id: string
  load: () => Promise<{ default: Component }>
  source: string
}

export const demos: Demo[] = Object.keys(modules)
  .sort()
  .map(path => {
    const id = path.match(/\.\/(.+)\.tsx$/)?.[1]
    if (!id) throw new Error(`gallery: unexpected path ${path}`)
    const source = sources[path]
    if (!source) throw new Error(`gallery: missing raw source for ${path}`)
    return { id, load: modules[path], source }
  })

export function pickRandomDemo(): Demo {
  if (demos.length === 0) throw new Error("gallery: no demos registered")
  return demos[Math.floor(Math.random() * demos.length)]
}
