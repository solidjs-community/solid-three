import { clientOnly } from "@solidjs/start"
import { createResource, createSignal, Show, startTransition } from "solid-js"
import { pickRandomDemo, type Demo } from "../snippets/gallery"

const LazyDemo = clientOnly(() => import("./demo"))

function PickDemo(props: { onPick: (demo: Demo) => void }) {
  props.onPick(pickRandomDemo())
  return null
}

const LazyPicker = clientOnly(() =>
  Promise.resolve({ default: PickDemo as any }),
)

export function Hero() {
  const [editorOpen, setEditorOpen] = createSignal(false)
  const [chosen, setChosen] = createSignal<Demo | undefined>()
  const [source] = createResource(chosen, demo => demo.loadSource())

  return (
    <div class="hero">
      <LazyPicker onPick={setChosen} />
      <Show when={chosen() && source()}>
        {sourceText => (
          <div class="hero-canvas">
            <LazyDemo
              code={sourceText()}
              url={chosen()?.url ?? ""}
              editorHidden={!editorOpen()}
            />
          </div>
        )}
      </Show>
      <Show when={!editorOpen()}>
        <div class="hero-overlay">
          <h1 class="hero-title">SOLID THREE</h1>
          <p class="hero-tagline">A SolidJS renderer for three.js.</p>
          <div class="hero-ctas">
            <a class="hero-cta" href="/tutorial/01-your-first-scene">
              Start the tutorial
            </a>
            <a class="hero-cta" href="/api">
              API reference
            </a>
          </div>
        </div>
      </Show>
      <Show when={chosen()}>
        <button
          type="button"
          class="hero-edit-toggle"
          onClick={() => startTransition(() => setEditorOpen(value => !value))}
        >
          {editorOpen() ? "Close editor" : "Edit"}
        </button>
      </Show>
    </div>
  )
}
