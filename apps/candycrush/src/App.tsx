import {
  Accessor,
  Index,
  Show,
  createEffect,
  createMemo,
  createSelector,
  createSignal,
  on,
  onCleanup,
  onMount,
  type Component,
} from 'solid-js'

import { Box, Icosahedron, OrthographicCamera } from '@solid-three/drei'
import { Canvas, T } from '@solid-three/fiber'
import { extend } from 'colord'
import namesPlugin from 'colord/plugins/names'
import { createStore } from 'solid-js/store'
import { Dynamic } from 'solid-js/web'
import { createGameState, evaluateState } from './logic'
extend([namesPlugin])

export const SHAPES = {
  // Box,
  // Sphere,
  // Cone,
  // Tetrahedron,
  Icosahedron,
}
export const COLORS = ['red', 'blue', 'green', 'purple'] as const
export const SIZE = 2
export const AMOUNT = 8
const DEBUG = false
export const DELAY = 125

type ValueOfObject<T> = T[keyof T]
type ValueOfArray<T extends readonly any[]> = T[number]
export type Matrix<T> = T[][]
export type Vector = [row: number, column: number]

export type Shape = ValueOfObject<typeof SHAPES>
export type Color = ValueOfArray<typeof COLORS>
export type GameState = Matrix<Color | undefined>

function isEqual<T extends any[] | undefined>(a: T, b: T) {
  return a && b && a.findIndex((_, index) => a[index] !== b[index]) === -1
}

const stopwatch = (duration: number, callback: (delta: number) => void) => {
  let delta = 0
  let canceled = false
  const start = performance.now()
  const loop = () => {
    if (canceled) return
    if (delta < 1) requestAnimationFrame(loop)
    delta += (performance.now() - start) / duration
    callback(Math.min(delta, 1))
  }
  loop()
  return () => {
    canceled = true
  }
}

const tween = (start: number, end: number, delta: number) => start * (1 - delta) + end * delta

function createTween<const T extends number | number[] | Record<string, number>>(
  enabled: Accessor<boolean>,
  start: T,
  end: T,
  easing?: (delta: number) => number,
) {
  const [delta, setDelta] = createSignal(0)

  createEffect(
    on(createMemo(enabled), (enabled) => {
      const start = delta()
      const cancel = !enabled
        ? stopwatch(1000, (delta) => setDelta(tween(start, 0, delta)))
        : stopwatch(1000, (delta) => setDelta(tween(start, 1, delta)))
      onCleanup(cancel)
    }),
  )

  return createMemo(() => {
    if (Array.isArray(start)) return start.map((value, index) => tween(value, (end as any[])[index], delta()))
    if (typeof start === 'object')
      return Object.fromEntries(
        Object.entries(start).map(([key, value]) => [key, tween(value, (end as Record<string, number>)[key], delta())]),
      )
    return tween(start, end as number, delta())
  }) as Accessor<T>
}

const Gem = (props: {
  color: Color
  type?: Shape
  position: Vector
  hovered: boolean
  selected: boolean
  onPointerOver: (position: Vector) => void
  onPointerOut: (position: Vector) => void
  onPointerDown: (position: Vector) => void
}) => {
  const pos = (index: number, size: number) => index * SIZE - ((size - 1) / 2) * SIZE
  const rotation = createTween<[number, number, number]>(() => props.hovered, [0, 1, 0], [0, -1, 0])
  const scale = createTween(() => props.hovered, 0.7, 1)

  return (
    <Show when={props.color}>
      <T.Group position={[pos(props.position[0], AMOUNT), pos(props.position[1], AMOUNT), 0]}>
        <Box
          scale={SIZE}
          onPointerOver={() => props.onPointerOver(props.position)}
          onPointerOut={() => props.onPointerOut(props.position)}
          onPointerDown={() => props.onPointerDown(props.position)}>
          <T.MeshBasicMaterial wireframe visible={props.hovered} />
        </Box>
        <Dynamic component={Icosahedron} rotation={rotation()} scale={scale()}>
          <T.MeshStandardMaterial color={props.color} />
        </Dynamic>
      </T.Group>
    </Show>
  )
}

const App: Component = () => {
  const [state, setState] = createStore(createGameState(AMOUNT, AMOUNT))
  const [score, setScore] = createSignal(0)

  const [hoverSelection, setHoverSelection] = createSignal<[number, number][]>([])
  const [selected, setSelected] = createSignal<[number, number]>()

  const addToScore = (points: number) => setScore((current) => current + points)

  onMount(() => {
    setTimeout(() => evaluateState(state, setState, addToScore), DELAY)
  })

  const highlightPosition = ([row, column]: Vector) => {
    if (selected()) {
      return
    }
    const directions = [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
      [0, 0],
    ] as [number, number][]
    setHoverSelection(
      directions
        .map(([_row, _column]) => [row + _row, column + _column] as [number, number])
        .filter(([row, column]) => row >= 0 && row < AMOUNT && column >= 0 && column < AMOUNT),
    )
  }
  const swapElements = (a: Vector, b: Vector) => {
    const sourceType = state[a[0]][a[1]]
    const targetType = state[b[0]][b[1]]
    setState(a[0], a[1], targetType)
    setState(b[0], b[1], sourceType)
    setSelected(undefined)
    highlightPosition([b[0], b[1]])
  }

  const onPointerOut = ([row, column]: Vector) => {
    if (selected()) {
      return
    }
    setHoverSelection([])
  }
  const onPointerOver = ([row, column]: Vector) => highlightPosition([row, column])
  const onPointerDown = ([row, column]: Vector) => {
    const _selected = selected()
    if (_selected) {
      if (!isEqual(_selected, [row, column]) && hoverSelection().find((value) => isEqual(value, [row, column]))) {
        swapElements(_selected, [row, column])
        setTimeout(() => evaluateState(state, setState, addToScore), DELAY)
      }
    } else {
      setSelected([row, column])
    }
  }

  const isSelected = createSelector(selected, (a, b) => isEqual(a, b))
  const isHovered = (a: Vector) => !!hoverSelection().find((b) => isEqual(a, b))

  return (
    <>
      <div
        style={{
          position: 'absolute',
          'z-index': 1,
          'font-size': '62pt',
          margin: '20px',
          color: 'white',
          border: '1px solid white',
          'padding-left': '10px',
          'padding-right': '10px',
          'border-radius': '15px',
        }}>
        {score()}
      </div>
      <Canvas style={{ width: '100vw', height: '100vh', cursor: hoverSelection().length > 0 ? 'pointer' : undefined }}>
        <T.Color attach="background" args={['goldenrod']} />
        <T.DirectionalLight />
        <T.AmbientLight />
        <T.Group position={[0, 0, 0]}>
          <Index each={state}>
            {(row, i) => (
              <Index each={row()}>
                {(color, j) => (
                  <Gem
                    position={[i, j]}
                    color={color()}
                    selected={isSelected([i, j])}
                    hovered={isHovered([i, j])}
                    onPointerOver={onPointerOver}
                    onPointerOut={onPointerOut}
                    onPointerDown={onPointerDown}
                  />
                )}
              </Index>
            )}
          </Index>
        </T.Group>
        <OrthographicCamera makeDefault position={[0, 0, 2]} zoom={40} />
      </Canvas>
    </>
  )
}

export default App
