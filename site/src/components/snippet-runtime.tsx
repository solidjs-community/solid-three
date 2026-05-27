import { render } from "solid-js/web"
import type { Component } from "solid-js"

export function mount(Snippet: Component, root: HTMLElement): () => void {
  return render(() => <Snippet />, root)
}
