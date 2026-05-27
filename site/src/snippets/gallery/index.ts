import type { Component } from "solid-js"

const modules = import.meta.glob<{ default: Component }>("./*.tsx")
const sources = import.meta.glob("./*.tsx", {
  query: "?raw",
  import: "default",
}) as Record<string, () => Promise<string>>

export interface Demo {
  id: string
  load: () => Promise<{ default: Component }>
  loadSource: () => Promise<string>
}

export const demos: Demo[] = Object.keys(modules)
  .sort()
  .map(path => {
    const id = path.match(/\.\/(.+)\.tsx$/)?.[1]
    if (!id) throw new Error(`gallery: unexpected path ${path}`)
    const loadSource = sources[path]
    if (!loadSource) throw new Error(`gallery: missing raw source for ${path}`)
    return { id, load: modules[path], loadSource }
  })

export function pickRandomDemo(): Demo {
  if (demos.length === 0) throw new Error("gallery: no demos registered")
  return demos[Math.floor(Math.random() * demos.length)]
}
