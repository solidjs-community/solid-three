import { createSignal } from "solid-js"
import * as THREE from "three"
import { Canvas, createT } from "../../../../src/index.ts"

const T = createT(THREE)

export default function () {
  const [frameloop, setFrameloop] = createSignal<"always" | "demand" | "never">("always")
  const [shadows, setShadows] = createSignal<
    boolean | "basic" | "percentage" | "soft" | "variance"
  >(false)
  const [orthographic, setOrthographic] = createSignal(false)

  return (
    <div>
      <details>
        <summary>
          <h3>Canvas Props Demo</h3>
        </summary>
        <div>
          <label>
            Frameloop:
            <select value={frameloop()} onChange={e => setFrameloop(e.target.value as any)}>
              <option value="always">always</option>
              <option value="demand">demand</option>
              <option value="never">never</option>
            </select>
          </label>
        </div>
        <div>
          <label>
            Shadows:
            <select
              value={shadows().toString()}
              onChange={e =>
                setShadows(e.target.value === "false" ? false : (e.target.value as any))
              }
            >
              <option value="false">false</option>
              <option value="true">true</option>
              <option value="basic">basic</option>
              <option value="percentage">percentage</option>
              <option value="soft">soft</option>
              <option value="variance">variance</option>
            </select>
          </label>
        </div>
        <div>
          <label>
            <input
              type="checkbox"
              checked={orthographic()}
              onChange={e => setOrthographic(e.target.checked)}
            />
            Orthographic Camera
          </label>
        </div>
      </details>

      <Canvas
        defaultCamera={{
          position: orthographic() ? [5, 5, 5] : [0, 0, 5],
          fov: 75,
        }}
        fallback={<div style={{ color: "white", padding: "20px" }}>Loading Canvas...</div>}
        gl={canvas =>
          new THREE.WebGLRenderer({
            canvas,
            antialias: true,
            alpha: true,
            powerPreference: "high-performance",
          })
        }
        scene={{
          background: new THREE.Color(0x202020),
          fog: new THREE.Fog(0x202020, 10, 50),
        }}
        defaultRaycaster={{
          params: {
            Mesh: {},
            LOD: {},
            Sprite: {},
            Line: { threshold: 0.1 },
            Points: { threshold: 0.1 },
          },
        }}
        shadows={shadows()}
        orthographic={orthographic()}
        linear={true}
        flat={false}
        frameloop={frameloop()}
        style={{
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          cursor: "pointer",
        }}
        onClick={e => console.info("Canvas clicked:", e)}
        onClickMissed={() => console.info("Clicked empty space")}
        onPointerMove={e => console.info("Pointer moved on canvas")}
      >
        <T.AmbientLight intensity={0.3} />
        <T.DirectionalLight
          position={[10, 10, 5]}
          intensity={1}
          castShadow={!!shadows()}
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />

        <T.Mesh
          position={[-2, 0, 0]}
          castShadow={!!shadows()}
          receiveShadow={!!shadows()}
          onClick={() => console.info("Red cube clicked!")}
        >
          <T.BoxGeometry args={[1, 1, 1]} />
          <T.MeshStandardMaterial color="red" />
        </T.Mesh>
      </Canvas>
    </div>
  )
}
