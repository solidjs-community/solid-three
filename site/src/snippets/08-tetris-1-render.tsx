import * as THREE from "three"
import { Index, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { Canvas, createT } from "solid-three"

const T = createT(THREE)

const WIDTH = 10
const HEIGHT = 20

const TETROMINOES = {
  I: { color: "cyan",   shape: [[1, 1, 1, 1]] },
  O: { color: "yellow", shape: [[1, 1], [1, 1]] },
  T: { color: "purple", shape: [[0, 1, 0], [1, 1, 1]] },
  S: { color: "green",  shape: [[0, 1, 1], [1, 1, 0]] },
  Z: { color: "red",    shape: [[1, 1, 0], [0, 1, 1]] },
  J: { color: "blue",   shape: [[1, 0, 0], [1, 1, 1]] },
  L: { color: "orange", shape: [[0, 0, 1], [1, 1, 1]] },
} as const

type TetrominoType = keyof typeof TETROMINOES
const TYPES = Object.keys(TETROMINOES) as TetrominoType[]

type Cell = string | undefined

type Piece = {
  type: TetrominoType
  shape: readonly (readonly number[])[]
  position: [x: number, y: number]
}

function emptyBoard(): Cell[][] {
  return Array.from({ length: HEIGHT }, () =>
    Array.from({ length: WIDTH }, () => undefined),
  )
}

function cellWorldPosition(x: number, y: number): [number, number, number] {
  return [x - WIDTH / 2 + 0.5, HEIGHT / 2 - y - 0.5, 0]
}

function Cell(props: { x: number; y: number; color: string }) {
  return (
    <T.Mesh position={cellWorldPosition(props.x, props.y)}>
      <T.BoxGeometry args={[0.95, 0.95, 0.95]} />
      <T.MeshStandardMaterial color={props.color} />
    </T.Mesh>
  )
}

function Tetromino(props: { piece: Piece }) {
  return (
    <Index each={props.piece.shape}>
      {(row, rowIndex) => (
        <Index each={row()}>
          {(filled, colIndex) => (
            <Show when={filled()}>
              <Cell
                x={props.piece.position[0] + colIndex}
                y={props.piece.position[1] + rowIndex}
                color={TETROMINOES[props.piece.type].color}
              />
            </Show>
          )}
        </Index>
      )}
    </Index>
  )
}

export default function App() {
  const [board] = createStore<Cell[][]>(emptyBoard())
  const [piece, setPiece] = createStore<Piece>({
    type: "T",
    shape: TETROMINOES.T.shape,
    position: [4, 9],
  })

  function cycleType() {
    const currentIndex = TYPES.indexOf(piece.type)
    const nextType = TYPES[(currentIndex + 1) % TYPES.length]
    setPiece({
      type: nextType,
      shape: TETROMINOES[nextType].shape,
      position: piece.position,
    })
  }

  return (
    <div
      onClick={cycleType}
      style={{ width: "100%", height: "100%", cursor: "pointer" }}
    >
      <Canvas
        orthographic
        camera={{ position: [0, 0, 20], zoom: 60 }}
      >
        <T.AmbientLight intensity={0.6} />
        <T.DirectionalLight position={[5, 10, 5]} intensity={0.8} />
        <Index each={board}>
          {(row, y) => (
            <Index each={row()}>
              {(color, x) => (
                <Show when={color()}>
                  <Cell x={x} y={y} color={color() as string} />
                </Show>
              )}
            </Index>
          )}
        </Index>
        <Tetromino piece={piece} />
      </Canvas>
    </div>
  )
}
