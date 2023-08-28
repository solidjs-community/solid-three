import { Canvas, T } from '@solid-three/fiber'

import { For, createSignal } from 'solid-js'
import Tests from './Tests'

import { OrbitControls } from '@solid-three/drei'
import { Dynamic } from 'solid-js/web'
import styles from './App.module.css'

const Setup = (props) => {
  return (
    <Canvas
      camera={{
        position: [3, 3, 3],
      }}
      gl={{
        antialias: true,
      }}
      shadows>
      {props.children}
      <OrbitControls />
      <T.SpotLight position={[0, 5, 10]} intensity={1} />
    </Canvas>
  )
}

export function App() {
  const [selection, setSelection] = createSignal('Parenting') //Object.keys(Tests)[0])
  return (
    <>
      <div class={styles.options}>
        <For each={Object.keys(Tests)}>
          {(test) => (
            <button
              style={{
                color: test === selection() ? 'blue' : undefined,
              }}
              onClick={() => {
                // console.clear()
                setSelection(test)
              }}>
              {test}
            </button>
          )}
        </For>
      </div>
      <Setup>
        <Dynamic component={Tests[selection()]} />
      </Setup>
    </>
  )
}
