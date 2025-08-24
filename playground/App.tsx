import { A, Route, Router } from "@solidjs/router"
import type { ParentProps } from "solid-js"
import * as THREE from "three"
import { createT, Entity } from "../src/index.ts"
import { EnvironmentExample } from "./examples/EnvironmentExample.tsx"
import { PluginExample } from "./examples/PluginExample.tsx"
import { PortalExample } from "./examples/PortalExample.tsx"
import { SolarExample } from "./examples/SolarExample.tsx"
import "./index.css"

const { T, Canvas } = createT({ ...THREE, Entity })

function Layout(props: ParentProps) {
  return (
    <>
      <nav
        style={{
          position: "absolute",
          top: "10px",
          left: "10px",
          "z-index": 1000,
          background: "rgba(0, 0, 0, 0.8)",
          padding: "10px",
          "border-radius": "8px",
        }}
      >
        <A
          href="/"
          style={{
            color: "white",
            "text-decoration": "none",
            padding: "5px 10px",
            display: "block",
          }}
        >
          Home
        </A>
        <A
          href="/simple-solar"
          style={{
            color: "white",
            "text-decoration": "none",
            padding: "5px 10px",
            display: "block",
          }}
        >
          Simple Solar
        </A>
        <A
          href="/portal"
          style={{
            color: "white",
            "text-decoration": "none",
            padding: "5px 10px",
            display: "block",
          }}
        >
          Portal
        </A>
        <A
          href="/environment"
          style={{
            color: "white",
            "text-decoration": "none",
            padding: "5px 10px",
            display: "block",
          }}
        >
          Environment
        </A>
        <A
          href="/plugin"
          style={{
            color: "white",
            "text-decoration": "none",
            padding: "5px 10px",
            display: "block",
          }}
        >
          Plugins
        </A>
      </nav>
      {props.children}
    </>
  )
}

export function App() {
  return (
    <Router root={Layout}>
      <Route path="/simple-solar" component={SolarExample} />
      <Route path="/portal" component={PortalExample} />
      <Route path="/environment" component={EnvironmentExample} />
      <Route path="/plugin" component={PluginExample} />
      <Route
        path="/"
        component={() => (
          <Canvas
            defaultCamera={{ position: new THREE.Vector3(0, 0, 15) }}
            scene={{ background: [1, 0, 0] }}
            style={{ width: "100vw", height: "100vh" }}
          >
            <Entity from={THREE.Group} position={[0, 0, 0]}>
              <T.Mesh>
                <T.BoxGeometry />
                <T.MeshBasicMaterial color="gray" />
              </T.Mesh>
            </Entity>
          </Canvas>
        )}
      />
    </Router>
  )
}
