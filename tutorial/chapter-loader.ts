import type { Component } from "solid-js"

export interface ChapterFrontmatter {
  id: string
  title: string
  part: number
  partTitle: string
  order: number
}

export interface ChapterModule {
  default: Component
  frontmatter: ChapterFrontmatter
}

const modules = import.meta.glob<ChapterModule>("./chapters/*.mdx", {
  eager: true,
})

export const chapters: ChapterModule[] = Object.values(modules).sort((a, b) => {
  if (a.frontmatter.part !== b.frontmatter.part) {
    return a.frontmatter.part - b.frontmatter.part
  }
  return a.frontmatter.order - b.frontmatter.order
})

export interface Part {
  part: number
  title: string
  chapters: ChapterModule[]
}

export const parts: Part[] = (() => {
  const grouped = new Map<number, Part>()
  for (const chapter of chapters) {
    const { part, partTitle } = chapter.frontmatter
    let entry = grouped.get(part)
    if (!entry) {
      entry = { part, title: partTitle, chapters: [] }
      grouped.set(part, entry)
    }
    entry.chapters.push(chapter)
  }
  return [...grouped.values()].sort((a, b) => a.part - b.part)
})()
