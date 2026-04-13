import { A, Route, Router } from "@solidjs/router"
import { createSignal, For, lazy, type ParentProps } from "solid-js"
import * as THREE from "three"
import { Canvas, createT, Entity } from "../src/index.ts"
import "./index.css"

const T = createT(THREE)

// Vite glob imports
const apiModules = import.meta.glob("./src/api/**/*.tsx") as Record<
  string,
  () => Promise<{ default: any }>
>
const exampleModules = import.meta.glob("./src/examples/*.tsx") as Record<
  string,
  () => Promise<{ default: any }>
>

// Create structured navigation
const apiStructure = Object.keys(apiModules).reduce((acc, path) => {
  const parts = path.split("/")
  const category = parts[3] // api/category/file.tsx
  const fileName = parts[4]?.replace(".tsx", "")

  if (category && fileName) {
    if (!acc[category]) acc[category] = []

    acc[category].push({
      name: fileName,
      path: path.replace("./src", "").replace(".tsx", ""),
      route: `/api/${category}/${fileName}`,
    })
  }

  return acc
}, {} as Record<string, Array<{ name: string; path: string; route: string }>>)

Object.values(apiStructure).forEach(api => {
  console.log(api.map(v => v.name))
  api.sort((a, b) => (a.name === "usage" ? -1 : b.name === "usage" ? 1 : a.name < b.name ? -1 : 1))
})

const examplesList = Object.keys(exampleModules).map(path => {
  const fileName = path.split("/").pop()?.replace(".tsx", "") || ""
  return {
    name: fileName,
    path: path /* .replace("./examples/", "") */
      .replace(".tsx", ""),
    route: `/examples/${fileName}`,
  }
})

function Layout(props: ParentProps) {
  const [activeTab, setActiveTab] = createSignal<"api" | "examples">("api")

  return (
    <>
      <nav class="playground-nav">
        {/* Tab Headers */}
        <div role="tablist" class="nav-tablist">
          <button
            id="api-tab"
            role="tab"
            aria-selected={activeTab() === "api" ? "true" : "false"}
            aria-controls="api-panel"
            tabindex={activeTab() === "api" ? 0 : -1}
            onClick={() => setActiveTab("api")}
            class="nav-tab"
          >
            API
          </button>
          <button
            id="examples-tab"
            role="tab"
            aria-selected={activeTab() === "examples" ? "true" : "false"}
            aria-controls="examples-panel"
            tabindex={activeTab() === "examples" ? 0 : -1}
            onClick={() => setActiveTab("examples")}
            class="nav-tab"
          >
            Examples
          </button>
        </div>

        {/* API Tab Panel */}
        <div
          role="tabpanel"
          id="api-panel"
          aria-labelledby="api-tab"
          hidden={activeTab() !== "api"}
          class="nav-tabpanel"
        >
          <For each={Object.entries(apiStructure)}>
            {entry => (
              <div class="nav-category">
                <h4 class="nav-category-title">{entry()[0]}</h4>
                <For each={entry()[1]}>
                  {item => (
                    <A href={item().route} class="nav-item-link">
                      {item()
                        .name.split("-")
                        .map(value => `${value[0].toUpperCase()}${value.slice(1)}`)
                        .join(" ")}
                    </A>
                  )}
                </For>
              </div>
            )}
          </For>
        </div>

        {/* Examples Tab Panel */}
        <div
          role="tabpanel"
          id="examples-panel"
          aria-labelledby="examples-tab"
          hidden={activeTab() !== "examples"}
          class="nav-tabpanel"
        >
          <h4 class="nav-examples-title">Demo Examples</h4>
          <For each={examplesList}>
            {item => (
              <A href={item().route} class="nav-example-link">
                {item().name}
              </A>
            )}
          </For>
        </div>
      </nav>
      {props.children}
    </>
  )
}

export function App() {
  return (
    <Router root={Layout}>
      <For each={[...Object.entries(apiModules), ...Object.entries(exampleModules)]}>
        {entry => (
          <Route
            path={entry()[0].replace("./src/", "").replace(".tsx", "")}
            component={lazy(entry()[1])}
          />
        )}
      </For>

      {/* Home route */}
      <Route
        path="/"
        component={() => (
          <Canvas
            defaultCamera={{ position: new THREE.Vector3(0, 0, 15) }}
            scene={{ background: [0.1, 0.1, 0.15] }}
            class="home-canvas"
          >
            <Entity from={THREE.Group}>
              <T.Mesh>
                <T.BoxGeometry />
                <T.MeshBasicMaterial color="gray" />
              </T.Mesh>
            </Entity>

            {/* Welcome text overlay */}
            <div class="home-welcome">
              <h1 class="home-title">solid-three Playground</h1>
              <p class="home-subtitle">Interactive examples and API demonstrations</p>
              <p class="home-description">Use the navigation panel to explore examples</p>
            </div>
          </Canvas>
        )}
      />
    </Router>
  )
}
