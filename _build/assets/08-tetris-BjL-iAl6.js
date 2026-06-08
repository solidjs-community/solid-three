import{P as e,Y as t}from"./web-Ca0kQsEY.js";import{n}from"./mdx-BDAsXIzm.js";var r=`import * as THREE from "three"
import { Index, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { Canvas, createT } from "solid-three"

const T = createT(THREE)

const WIDTH = 10
const HEIGHT = 20

const TETROMINOES = {
  I: { color: "cyan", shape: [[1, 1, 1, 1]] },
  O: {
    color: "yellow",
    shape: [
      [1, 1],
      [1, 1],
    ],
  },
  T: {
    color: "purple",
    shape: [
      [0, 1, 0],
      [1, 1, 1],
    ],
  },
  S: {
    color: "green",
    shape: [
      [0, 1, 1],
      [1, 1, 0],
    ],
  },
  Z: {
    color: "red",
    shape: [
      [1, 1, 0],
      [0, 1, 1],
    ],
  },
  J: {
    color: "blue",
    shape: [
      [1, 0, 0],
      [1, 1, 1],
    ],
  },
  L: {
    color: "orange",
    shape: [
      [0, 0, 1],
      [1, 1, 1],
    ],
  },
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
  return Array.from({ length: HEIGHT }, () => Array.from({ length: WIDTH }, () => undefined))
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
    <div onClick={cycleType} style={{ width: "100%", height: "100%", cursor: "pointer" }}>
      <Canvas orthographic camera={{ position: [0, 0, 20], zoom: 60 }}>
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
`,i=new URL(`08-tetris-1-render-DSCIahBk.js`,import.meta.url).href,a=`import * as THREE from "three"
import { Index, Show, batch, onCleanup, onMount } from "solid-js"
import { createStore } from "solid-js/store"
import { Canvas, createT } from "solid-three"

const T = createT(THREE)

const WIDTH = 10
const HEIGHT = 20
const TICK_MS = 500

const TETROMINOES = {
  I: { color: "cyan", shape: [[1, 1, 1, 1]] },
  O: {
    color: "yellow",
    shape: [
      [1, 1],
      [1, 1],
    ],
  },
  T: {
    color: "purple",
    shape: [
      [0, 1, 0],
      [1, 1, 1],
    ],
  },
  S: {
    color: "green",
    shape: [
      [0, 1, 1],
      [1, 1, 0],
    ],
  },
  Z: {
    color: "red",
    shape: [
      [1, 1, 0],
      [0, 1, 1],
    ],
  },
  J: {
    color: "blue",
    shape: [
      [1, 0, 0],
      [1, 1, 1],
    ],
  },
  L: {
    color: "orange",
    shape: [
      [0, 0, 1],
      [1, 1, 1],
    ],
  },
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
  return Array.from({ length: HEIGHT }, () => Array.from({ length: WIDTH }, () => undefined))
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
  const out: number[][] = Array.from({ length: cols }, () => Array.from({ length: rows }, () => 0))
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

function Walls() {
  return (
    <>
      <T.Mesh position={[-WIDTH / 2 - 0.5, 0, 0]}>
        <T.BoxGeometry args={[1, HEIGHT + 1, 1]} />
        <T.MeshStandardMaterial color="white" />
      </T.Mesh>
      <T.Mesh position={[WIDTH / 2 + 0.5, 0, 0]}>
        <T.BoxGeometry args={[1, HEIGHT + 1, 1]} />
        <T.MeshStandardMaterial color="white" />
      </T.Mesh>
      <T.Mesh position={[0, -HEIGHT / 2 - 0.5, 0]}>
        <T.BoxGeometry args={[WIDTH + 2, 1, 1]} />
        <T.MeshStandardMaterial color="white" />
      </T.Mesh>
    </>
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
    <Canvas orthographic camera={{ position: [0, 0, 20], zoom: 14 }}>
      <T.AmbientLight intensity={0.6} />
      <T.DirectionalLight position={[5, 10, 5]} intensity={0.8} />
      <Walls />
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
`,o=new URL(`08-tetris-2-fall-Ck-IbGXm.js`,import.meta.url).href,s=`import * as THREE from "three"
import { Index, Show, batch, createSignal, onCleanup, onMount } from "solid-js"
import { createStore, produce } from "solid-js/store"
import { Portal } from "solid-js/web"
import { Canvas, createT } from "solid-three"

const T = createT(THREE)

const WIDTH = 10
const HEIGHT = 20
const TICK_MS = 500
const LINE_SCORES = [0, 100, 300, 500, 800] as const

const TETROMINOES = {
  I: { color: "cyan", shape: [[1, 1, 1, 1]] },
  O: {
    color: "yellow",
    shape: [
      [1, 1],
      [1, 1],
    ],
  },
  T: {
    color: "purple",
    shape: [
      [0, 1, 0],
      [1, 1, 1],
    ],
  },
  S: {
    color: "green",
    shape: [
      [0, 1, 1],
      [1, 1, 0],
    ],
  },
  Z: {
    color: "red",
    shape: [
      [1, 1, 0],
      [0, 1, 1],
    ],
  },
  J: {
    color: "blue",
    shape: [
      [1, 0, 0],
      [1, 1, 1],
    ],
  },
  L: {
    color: "orange",
    shape: [
      [0, 0, 1],
      [1, 1, 1],
    ],
  },
} as const

type TetrominoType = keyof typeof TETROMINOES
const TYPES = Object.keys(TETROMINOES) as TetrominoType[]

type Cell = string | undefined

type Piece = {
  type: TetrominoType
  shape: number[][]
  position: [x: number, y: number]
}

function emptyRow(): Cell[] {
  return Array.from({ length: WIDTH }, () => undefined)
}

function emptyBoard(): Cell[][] {
  return Array.from({ length: HEIGHT }, emptyRow)
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
  const out: number[][] = Array.from({ length: cols }, () => Array.from({ length: rows }, () => 0))
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

function Walls() {
  return (
    <>
      <T.Mesh position={[-WIDTH / 2 - 0.5, 0, 0]}>
        <T.BoxGeometry args={[1, HEIGHT + 1, 1]} />
        <T.MeshStandardMaterial color="white" />
      </T.Mesh>
      <T.Mesh position={[WIDTH / 2 + 0.5, 0, 0]}>
        <T.BoxGeometry args={[1, HEIGHT + 1, 1]} />
        <T.MeshStandardMaterial color="white" />
      </T.Mesh>
      <T.Mesh position={[0, -HEIGHT / 2 - 0.5, 0]}>
        <T.BoxGeometry args={[WIDTH + 2, 1, 1]} />
        <T.MeshStandardMaterial color="white" />
      </T.Mesh>
    </>
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
  const [score, setScore] = createSignal(0)
  const [playing, setPlaying] = createSignal(true)

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

  function clearLines(): number {
    const fullRows: number[] = []
    for (let y = 0; y < HEIGHT; y++) {
      if (board[y].every(c => c !== undefined)) fullRows.push(y)
    }
    if (fullRows.length === 0) return 0
    setBoard(
      produce(rows => {
        for (let i = fullRows.length - 1; i >= 0; i--) {
          rows.splice(fullRows[i], 1)
          rows.unshift(emptyRow())
        }
      }),
    )
    return fullRows.length
  }

  function spawn() {
    const next = randomPiece()
    if (collides(next.shape, next.position[0], next.position[1])) {
      setPlaying(false)
      return
    }
    setPiece(next)
  }

  function tryMove(dx: number, dy: number): boolean {
    if (!playing()) return false
    const nx = piece.position[0] + dx
    const ny = piece.position[1] + dy
    if (!collides(piece.shape, nx, ny)) {
      setPiece("position", [nx, ny])
      return true
    }
    if (dy > 0) {
      lock()
      const cleared = clearLines()
      if (cleared > 0) setScore(s => s + LINE_SCORES[cleared])
      spawn()
    }
    return false
  }

  function tryRotate() {
    if (!playing()) return
    const rotated = rotateClockwise(piece.shape)
    if (!collides(rotated, piece.position[0], piece.position[1])) {
      setPiece("shape", rotated)
    }
  }

  function hardDrop() {
    if (!playing()) return
    while (tryMove(0, 1)) {
      // keep falling
    }
  }

  function reset() {
    batch(() => {
      setBoard(emptyBoard())
      setPiece(randomPiece())
      setScore(0)
      setPlaying(true)
    })
  }

  onMount(() => {
    const intervalId = setInterval(() => {
      if (playing()) tryMove(0, 1)
    }, TICK_MS)

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
      clearInterval(intervalId)
      window.removeEventListener("keydown", onKeyDown)
    })
  })

  return (
    <>
      <Portal>
        <div
          style={{
            position: "absolute",
            top: "1rem",
            left: "1rem",
            "z-index": 1,
            padding: "0.75rem 1rem",
            background: "rgba(20,23,31,0.9)",
            color: "#e8e8e8",
            "font-family": "ui-monospace, monospace",
            "font-size": "0.85rem",
            "border-radius": "6px",
            "min-width": "8rem",
          }}
        >
          <div>score: {score()}</div>
          <Show when={!playing()}>
            <button
              onClick={reset}
              style={{
                "margin-top": "0.5rem",
                padding: "0.3rem 0.75rem",
                background: "tomato",
                color: "#fff",
                border: "0",
                "border-radius": "4px",
                cursor: "pointer",
                "font-size": "0.8rem",
              }}
            >
              play again
            </button>
          </Show>
        </div>
      </Portal>
      <Canvas orthographic camera={{ position: [0, 0, 20], zoom: 14 }}>
        <T.AmbientLight intensity={0.6} />
        <T.DirectionalLight position={[5, 10, 5]} intensity={0.8} />
        <Walls />
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
    </>
  )
}
`,c=new URL(`08-tetris-3-lines-CfA7wjfB.js`,import.meta.url).href,l=[{title:`Let's build Tetris`,href:`#lets-build-tetris`,children:[{title:`Stage 1 — Two stores, some JSX`,href:`#stage-1--two-stores-some-jsx`,children:[]},{title:`Stage 2 — Gravity and keys`,href:`#stage-2--gravity-and-keys`,children:[]},{title:`Stage 3 — Lines and score`,href:`#stage-3--lines-and-score`,children:[]},{title:`The takeaway`,href:`#the-takeaway`,children:[]}]}],u={title:`Let's build Tetris`};function d(t){let l={a:`a`,code:`code`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,strong:`strong`,ul:`ul`,...n(),...t.components},{Demo:u}=l;return u||p(`Demo`,!0),[e(l.h1,{id:`lets-build-tetris`,get children(){return e(l.a,{"data-auto-heading":``,href:`#lets-build-tetris`,children:`Let's build Tetris`})}}),`
`,e(l.p,{children:`This chapter is bigger than the others. We're building Tetris across three
demos so you can watch the state grow.`}),`
`,e(l.h2,{id:`stage-1--two-stores-some-jsx`,get children(){return e(l.a,{"data-auto-heading":``,href:`#stage-1--two-stores-some-jsx`,children:`Stage 1 — Two stores, some JSX`})}}),`
`,e(u,{code:r,url:i}),`
`,e(l.p,{children:`There's no game here yet — just two stores and JSX that reads them.`}),`
`,e(l.ul,{get children(){return[`
`,e(l.li,{get children(){return[e(l.strong,{children:`The board`}),` is a 2D matrix of optional colors, stored with
`,e(l.code,{children:`createStore`}),`. We render it with two nested `,e(l.code,{children:`<Index>`}),` components, one
per row, one per cell. Empty cells are skipped with `,e(l.code,{children:`<Show>`}),`.`]}}),`
`,e(l.li,{get children(){return[e(l.strong,{children:`The piece`}),` is a `,e(l.code,{children:`{ type, shape, position }`}),` store. The `,e(l.code,{children:`<Tetromino>`}),`
component reads it and emits one `,e(l.code,{children:`<Cell>`}),` per filled square in the
shape, offset by the piece's position.`]}}),`
`]}}),`
`,e(l.p,{get children(){return[`The two are rendered as `,e(l.strong,{children:`two parallel passes`}),`: the locked board owns
its JSX, the active piece owns its JSX. No merge step — each piece of
state draws itself.`]}}),`
`,e(l.p,{children:`Click any cube of the piece to cycle it through I → O → T → S → Z → J → L
and back. Mutating the store is the only thing that's changing.`}),`
`,e(l.h2,{id:`stage-2--gravity-and-keys`,get children(){return e(l.a,{"data-auto-heading":``,href:`#stage-2--gravity-and-keys`,children:`Stage 2 — Gravity and keys`})}}),`
`,e(u,{code:a,url:o}),`
`,e(l.p,{children:`We added three things:`}),`
`,e(l.ul,{get children(){return[`
`,e(l.li,{get children(){return[`A `,e(l.code,{children:`setInterval`}),` that calls `,e(l.code,{children:`tryMove(0, 1)`}),` every half-second. That's
gravity.`]}}),`
`,e(l.li,{get children(){return[`A `,e(l.code,{children:`keydown`}),` listener on `,e(l.code,{children:`window`}),`. ← and → move the piece, ↓ soft-drops
one cell, ↑ rotates, `,e(l.strong,{children:`space`}),` hard-drops to the bottom.`]}}),`
`,e(l.li,{get children(){return[`A `,e(l.code,{children:`tryMove(dx, dy)`}),` function that checks the new position against the
board's bounds and locked cells before mutating the piece's position.
If the move was downward and blocked, it locks the piece into the
board and spawns the next one.`]}}),`
`]}}),`
`,e(l.p,{get children(){return[`Notice what isn't here: nothing 3D, nothing `,e(l.code,{children:`solid-three`}),`-specific. Same
wiring you'd use for a todo app.`]}}),`
`,e(l.h2,{id:`stage-3--lines-and-score`,get children(){return e(l.a,{"data-auto-heading":``,href:`#stage-3--lines-and-score`,children:`Stage 3 — Lines and score`})}}),`
`,e(u,{code:s,url:c}),`
`,e(l.p,{children:`Two more additions:`}),`
`,e(l.ul,{get children(){return[`
`,e(l.li,{get children(){return[`After every lock, `,e(l.code,{children:`clearLines()`}),` finds full rows and `,e(l.code,{children:`splice`}),`s them out
of the board store inside a `,e(l.code,{children:`produce`}),`, prepending empties to keep the
matrix the same shape. The number of rows cleared maps to the classic
scoring table: 100 / 300 / 500 / 800.`]}}),`
`,e(l.li,{get children(){return[`A `,e(l.code,{children:`score`}),` signal. A `,e(l.a,{href:`/api/components/portal`,get children(){return e(l.code,{children:`<Portal>`})}}),` puts the score panel in the DOM next
to the canvas. When a fresh piece can't fit at the top, a `,e(l.code,{children:`<Show>`}),`
reveals a "play again" button that resets everything.`]}}),`
`]}}),`
`,e(l.h2,{id:`the-takeaway`,get children(){return e(l.a,{"data-auto-heading":``,href:`#the-takeaway`,children:`The takeaway`})}}),`
`,e(l.p,{get children(){return[`Game development is state management. Solid is a state manager that
happens to render `,e(l.a,{href:`/api/components/t`,get children(){return e(l.code,{children:`<T.Mesh>`})}}),`.`]}}),`
`,e(l.p,{children:`Look back at what we built. Every visible cube is a function of two
stores. Every input — a key press, an interval tick, a click — is a
plain function that mutates one of those stores. Solid's job is to
re-run the JSX bindings that read the changed state; our job is to
describe the JSX and decide when to mutate.`}),`
`,e(l.p,{get children(){return[`The shape of every other `,e(l.code,{children:`solid-three`}),` app you'll write is the same as
this one: signals and stores describing state, JSX describing the scene,
`,e(l.code,{children:`<T.*>`}),` keeping the scene in sync with state. The
`,e(l.a,{href:`/api/types`,children:`API reference`}),` is there when you need a specific export.`]}}),`
`,e(l.p,{children:`There's one more kind of power worth knowing: when a prop you want isn't a
property, you can add it yourself. Next up — plugins.`})]}function f(r={}){let{wrapper:i}={...n(),...r.components};return i?e(i,t(r,{get children(){return e(d,r)}})):d(r)}function p(e,t){throw Error(`Expected `+(t?`component`:`object`)+" `"+e+"` to be defined: you likely forgot to import, pass, or provide it.")}var m={frontmatter:u===void 0?{}:u??{},toc:l===void 0?void 0:l,editLink:``,lastUpdated:1780917478e3};typeof window<`u`&&(window.$$SolidBase_page_data??={},window.$$SolidBase_page_data[`/home/runner/work/solid-three/solid-three/site/src/routes/tour/08-tetris.mdx`]=m);var h=m;export{h as $$SolidBase_page_data,f as default,u as frontmatter};