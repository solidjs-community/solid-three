import { clientOnly } from "@solidjs/start"
import { createResource, createSignal, Show } from "solid-js"
import { pickRandomDemo, type Demo } from "../snippets/gallery"

const LazyDemo = clientOnly(() => import("./demo"))

function ChosenScene(props: { onPick: (demo: Demo) => void }) {
  const demo = pickRandomDemo()
  props.onPick(demo)
  const LazyScene = clientOnly(demo.load)
  return <LazyScene />
}

const LazyChosenScene = clientOnly(() =>
  Promise.resolve({ default: ChosenScene as any }),
)

export function Hero() {
  const [editorOpen, setEditorOpen] = createSignal(false)
  const [chosen, setChosen] = createSignal<Demo | undefined>()
  const [source] = createResource(
    () => (editorOpen() ? chosen() : undefined),
    demo => demo.loadSource(),
  )

  return (
    <div class="hero">
      <Show when={!editorOpen()}>
        <div class="hero-canvas">
          <LazyChosenScene onPick={setChosen} />
        </div>
      </Show>
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
      <Show when={chosen()}>
        <button
          type="button"
          class="hero-edit-toggle"
          onClick={() => setEditorOpen(value => !value)}
        >
          {editorOpen() ? "Close editor" : "Edit"}
        </button>
      </Show>
      <Show when={editorOpen() && source()}>
        {sourceText => (
          <div class="hero-editor-overlay">
            <LazyDemo code={sourceText()} url={chosen()?.url ?? ""} />
          </div>
        )}
      </Show>
    </div>
  )
}
