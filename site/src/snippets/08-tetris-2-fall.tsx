import * as THREE from "three"
import { Index, Show, batch, onCleanup, onMount } from "solid-js"
import { createStore } from "solid-js/store"
import { Canvas, createT } from "solid-three"

const T = createT(THREE)

const WIDTH = 10
const HEIGHT = 20
const TICK_MS = 500

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
  shape: number[][]
  position: [x: number, y: number]
}

function emptyBoard(): Cell[][] {
  return Array.from({ length: HEIGHT }, () =>
    Array.from({ length: WIDTH }, () => undefined),
  )
}

function randomPiece(): Piece {
  const type = TYPES[Math.floor(Math.random() * TYPES.length)]
  const shape = TETROMINOES[type].shape.map(row => [...row])
  const startX = Math.floor((WIDTH - shape[0].length) / 2)
  return { type, shape, position: [startX, 0] }
}

function rotateClockwise(shape: number[][]): number[][] {
  const rows = shape.length
  const cols = shape[0].length
  const out: number[][] = Array.from({ length: cols }, () =>
    Array.from({ length: rows }, () => 0),
  )
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      out[x][rows - 1 - y] = shape[y][x]
    }
  }
  return out
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
  const [board, setBoard] = createStore<Cell[][]>(emptyBoard())
  const [piece, setPiece] = createStore<Piece>(randomPiece())

  function collides(shape: number[][], px: number, py: number): boolean {
    for (let row = 0; row < shape.length; row++) {
      for (let col = 0; col < shape[row].length; col++) {
        if (!shape[row][col]) continue
        const x = px + col
        const y = py + row
        if (x < 0 || x >= WIDTH || y >= HEIGHT) return true
        if (y >= 0 && board[y][x]) return true
      }
    }
    return false
  }

  function lock() {
    batch(() => {
      for (let row = 0; row < piece.shape.length; row++) {
        for (let col = 0; col < piece.shape[row].length; col++) {
          if (!piece.shape[row][col]) continue
          const x = piece.position[0] + col
          const y = piece.position[1] + row
          if (y >= 0 && y < HEIGHT && x >= 0 && x < WIDTH) {
            setBoard(y, x, TETROMINOES[piece.type].color)
          }
        }
      }
    })
  }

  let stopGravity: (() => void) | undefined
  function gameOver() {
    stopGravity?.()
  }

  function spawn() {
    const next = randomPiece()
    if (collides(next.shape, next.position[0], next.position[1])) {
      gameOver()
      return
    }
    setPiece(next)
  }

  function tryMove(dx: number, dy: number): boolean {
    const nx = piece.position[0] + dx
    const ny = piece.position[1] + dy
    if (!collides(piece.shape, nx, ny)) {
      setPiece("position", [nx, ny])
      return true
    }
    if (dy > 0) {
      lock()
      spawn()
    }
    return false
  }

  function tryRotate() {
    const rotated = rotateClockwise(piece.shape)
    if (!collides(rotated, piece.position[0], piece.position[1])) {
      setPiece("shape", rotated)
    }
  }

  function hardDrop() {
    while (tryMove(0, 1)) {
      // keep falling
    }
  }

  onMount(() => {
    const intervalId = setInterval(() => tryMove(0, 1), TICK_MS)
    stopGravity = () => clearInterval(intervalId)

    function onKeyDown(event: KeyboardEvent) {
      switch (event.key) {
        case "ArrowLeft":
          tryMove(-1, 0)
          break
        case "ArrowRight":
          tryMove(1, 0)
          break
        case "ArrowDown":
          tryMove(0, 1)
          break
        case "ArrowUp":
          tryRotate()
          break
        case " ":
          event.preventDefault()
          hardDrop()
          break
      }
    }
    window.addEventListener("keydown", onKeyDown)

    onCleanup(() => {
      stopGravity?.()
      window.removeEventListener("keydown", onKeyDown)
    })
  })

  return (
    <Canvas
      orthographic
      camera={{ position: [0, 0, 20], zoom: 22 }}
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
  )
}
