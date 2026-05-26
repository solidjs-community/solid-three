import { clientOnly } from "@solidjs/start"
import { createSignal, Show } from "solid-js"
import heroSource from "../snippets/hero.tsx?raw"

const LazyHeroScene = clientOnly(() => import("../snippets/hero"))
const LazyDemo = clientOnly(() => import("./demo"))

export function Hero() {
  const [editorOpen, setEditorOpen] = createSignal(false)

  return (
    <div class="hero">
      <div class="hero-canvas">
        <LazyHeroScene />
      </div>
      <div class="hero-overlay">
        <h1 class="hero-title">solid-three</h1>
        <p class="hero-tagline">A SolidJS renderer for three.js.</p>
        <div class="hero-ctas">
          <a class="hero-cta hero-cta-primary" href="/tutorial/01-your-first-scene">
            Start the tutorial
          </a>
          <a class="hero-cta" href="/api">
            API reference
          </a>
        </div>
      </div>
      <button type="button" class="hero-edit-toggle" onClick={() => setEditorOpen(value => !value)}>
        {editorOpen() ? "Close editor" : "Edit"}
      </button>
      <Show when={editorOpen()}>
        <div class="hero-editor-overlay">
          <LazyDemo code={heroSource} />
        </div>
      </Show>
    </div>
  )
}
