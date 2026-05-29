# Tetris Chapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the tutorial's whack-a-cube "small game" chapter with a Tetris built across three live demos on a single page, driving home the takeaway "game development is state management; Solid is a state manager that happens to render `<T.Mesh>`."

**Architecture:** Three self-contained `.tsx` snippets in `site/src/snippets/` (stage 1 = rendering, stage 2 = falling + keys, stage 3 = lines + score), each consumed as a `?raw` import by a single `.mdx` chapter page that renders them with the existing `<Demo>` component. Shared model: two stores (`board` 2D matrix, `piece` {type, shape, position}) plus a `score` signal in stage 3. Rendering uses two parallel passes (`<Index each={board}>` for locked cells + `<Tetromino piece={piece} />` for the active piece) rather than a merged memo — that's the pedagogical punchline.

**Tech Stack:** `solid-three` (`Canvas`, `createT(THREE)`, `useFrame`), `solid-js` (`createSignal`, `onMount`, `onCleanup`, `Index`, `Show`, `For`, `batch`), `solid-js/store` (`createStore`, `produce`), `solid-js/web` (`Portal`), `three`. No drei. No tests — this is a tutorial chapter; verification is "open the dev server, play the demo, confirm it behaves."

**Spec:** `docs/superpowers/specs/2026-05-27-tetris-chapter-design.md`

**Source for inspiration (don't copy directly):** `apps/tetris/src/App.tsx` at git commit `f3374cf` — the maximalist original.

**Verification approach:** This is a docs site, not a library. There are no unit tests for tutorial snippets. Verification for each task is a manual check in the dev server (`pnpm --filter solid-three-site dev`) at `http://localhost:<port>/tutorial/08-tetris`. Each task description specifies what to look for. Treat any TypeScript error from `pnpm --filter solid-three-site exec tsc --noEmit` as a hard failure.

---

## File Structure

**New files:**
- `site/src/snippets/08-tetris-1-render.tsx` — Stage 1: render-only, click-to-cycle.
- `site/src/snippets/08-tetris-2-fall.tsx` — Stage 2: + gravity, keyboard, lock, spawn.
- `site/src/snippets/08-tetris-3-lines.tsx` — Stage 3: + line-clearing, score, game-over.
- `site/src/routes/tutorial/08-tetris.mdx` — Chapter page importing all three snippets.

**Files to delete:**
- `site/src/snippets/08-interactive-scene.tsx` — Old whack-a-cube snippet.
- `site/src/routes/tutorial/08-interactive-scene.mdx` — Old chapter page.

**No other files modified.** The tutorial nav reads chapter frontmatter `title`, not filenames (verified during Task 0).

---

## Task 0: Verify rename safety and dev-server entry point

**Files:**
- Read-only: `site/src/routes/tutorial/`, `site/src/components/`, any tutorial nav config.

- [ ] **Step 1: Confirm how the tutorial sidebar lists chapters**

Run:
```bash
grep -rn "tutorial" site/src/components/ site/src/routes/tutorial/ site/src/app.tsx site/src/routes.tsx 2>/dev/null | grep -iE "nav|sidebar|index|order|list" | head -20
```
Also check if there's a SolidBase config:
```bash
find site -maxdepth 3 -name "*.config.*" -o -name "solidbase.*" 2>/dev/null
ls site/src/routes/tutorial/
```
Expected: either filename-based ordering (e.g., chapters listed by `08-*`) or a config that maps URLs to titles. Document which it is.

- [ ] **Step 2: Start the dev server in the background**

Run:
```bash
cd site && pnpm dev
```
Capture the port from the output (e.g., `http://localhost:3000`). Visit `http://localhost:<port>/tutorial/08-interactive-scene` and confirm the current whack-a-cube chapter renders.

- [ ] **Step 3: Note the verification URL for upcoming tasks**

Record in your scratch notes: the dev-server URL for the new chapter will be `http://localhost:<port>/tutorial/08-tetris` once renamed in Task 7.

- [ ] **Step 4: No commit** — this task is purely investigative.

---

## Task 1: Stage 1 — Render-only Tetris with click-to-cycle

**Files:**
- Create: `site/src/snippets/08-tetris-1-render.tsx`

- [ ] **Step 1: Create the snippet file with full contents**

Write `site/src/snippets/08-tetris-1-render.tsx`:

```tsx
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

// The board is indexed [y][x] — y grows downward, matching screen space.
// The piece's position is [x, y] for readability when writing logic.
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

function Tetromino(props: { piece: Piece; onClick: () => void }) {
  return (
    <Index each={props.piece.shape}>
      {(row, rowIndex) => (
        <Index each={row()}>
          {(filled, colIndex) => (
            <Show when={filled()}>
              <T.Mesh
                position={cellWorldPosition(
                  props.piece.position[0] + colIndex,
                  props.piece.position[1] + rowIndex,
                )}
                onClick={event => {
                  event.stopPropagation()
                  props.onClick()
                }}
              >
                <T.BoxGeometry args={[0.95, 0.95, 0.95]} />
                <T.MeshStandardMaterial color={TETROMINOES[props.piece.type].color} />
              </T.Mesh>
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
      <Tetromino piece={piece} onClick={cycleType} />
    </Canvas>
  )
}
```

- [ ] **Step 2: Type-check the snippet**

Run:
```bash
cd site && pnpm exec tsc --noEmit
```
Expected: no errors.

If there are errors related to `solid-three` exports (`Canvas`, `createT`), check `site/src/snippets/08-interactive-scene.tsx` to confirm the same import shape works there. They should match.

- [ ] **Step 3: Temporarily wire the snippet into the existing chapter for visual verification**

Edit `site/src/routes/tutorial/08-interactive-scene.mdx`. Find the existing `<Demo>` line near the top and add ONE new line above it:

```mdx
import tetris1 from "../../snippets/08-tetris-1-render.tsx?raw"
```

Then, immediately after the existing `<Demo code={interactiveScene} />`, add:

```mdx
<Demo code={tetris1} />
```

This is temporary scaffolding so we can see Stage 1 render. Task 7 deletes this whole file.

- [ ] **Step 4: Verify in the dev server**

Visit `http://localhost:<port>/tutorial/08-interactive-scene` in a browser. Scroll past the whack-a-cube. You should see a Tetris board area (mostly empty) with a single purple T-shaped tetromino in the lower portion. Clicking any cube of the T should cycle the piece through I, O, T, S, Z, J, L and back to I, with the color and shape both changing each click.

If the canvas looks empty or off-screen, the orthographic camera `zoom` may need adjusting. Try values in the range `15`–`28`. If clicks don't register, confirm `event.stopPropagation()` is present and that there's nothing else intercepting the events.

- [ ] **Step 5: Commit**

```bash
git add site/src/snippets/08-tetris-1-render.tsx site/src/routes/tutorial/08-interactive-scene.mdx
git commit -m "feat(site): add tetris stage 1 snippet (render + cycle)"
```

---

## Task 2: Stage 2 — Add gravity, keyboard, lock, spawn

**Files:**
- Create: `site/src/snippets/08-tetris-2-fall.tsx`

- [ ] **Step 1: Create the snippet file with full contents**

Write `site/src/snippets/08-tetris-2-fall.tsx`:

```tsx
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

  // Check whether placing `shape` at `[px, py]` would collide with the
  // board's walls/floor or any locked cell. Out-of-bounds counts as a
  // collision; the piece spawning above the visible board is not in scope
  // here (pieces spawn at y=0).
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

  // Try to move the piece by (dx, dy). Returns true if the move happened.
  // If the move was downward and blocked, locks the piece and spawns the
  // next one.
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
```

- [ ] **Step 2: Type-check**

Run:
```bash
cd site && pnpm exec tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Wire Stage 2 into the temporary chapter**

Edit `site/src/routes/tutorial/08-interactive-scene.mdx`. Add a second import:

```mdx
import tetris2 from "../../snippets/08-tetris-2-fall.tsx?raw"
```

And a second new `<Demo>`:

```mdx
<Demo code={tetris2} />
```

- [ ] **Step 4: Verify in the dev server**

Visit the chapter URL. Click into the Stage 2 demo so it has keyboard focus. Confirm:
- A random piece appears at the top center and falls one cell every 0.5s.
- Left/Right arrows move it horizontally; blocked at the side walls.
- Down arrow steps it down one cell; blocked when stacked.
- Up arrow rotates 90° clockwise; blocked if rotation would overlap.
- Space drops the piece instantly to the bottom of its column, locks it, and spawns the next piece.
- Locked pieces remain coloured on the board.
- After enough stacking, when a fresh piece can't fit at the top, gravity stops (board freezes; no UI yet — that's Stage 3).

If the keyboard appears unresponsive, the `<Demo>` iframe may need to be focused first (click inside the canvas area). If hard-drop scrolls the page instead, double-check the `event.preventDefault()` is reached. If pieces clip through the floor on rotation, check `collides()` — out-of-bounds on x or `y >= HEIGHT` must be a collision.

- [ ] **Step 5: Commit**

```bash
git add site/src/snippets/08-tetris-2-fall.tsx site/src/routes/tutorial/08-interactive-scene.mdx
git commit -m "feat(site): add tetris stage 2 snippet (gravity + keys)"
```

---

## Task 3: Stage 3 — Lines, score, game-over UI

**Files:**
- Create: `site/src/snippets/08-tetris-3-lines.tsx`

- [ ] **Step 1: Create the snippet file with full contents**

Write `site/src/snippets/08-tetris-3-lines.tsx`:

```tsx
import * as THREE from "three"
import {
  Index,
  Show,
  batch,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js"
import { createStore, produce } from "solid-js/store"
import { Portal } from "solid-js/web"
import { Canvas, createT } from "solid-three"

const T = createT(THREE)

const WIDTH = 10
const HEIGHT = 20
const TICK_MS = 500
const LINE_SCORES = [0, 100, 300, 500, 800] as const

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
        // Splice from the bottom up so earlier indices stay valid.
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
    </>
  )
}
```

- [ ] **Step 2: Type-check**

Run:
```bash
cd site && pnpm exec tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Wire Stage 3 into the temporary chapter**

Edit `site/src/routes/tutorial/08-interactive-scene.mdx`. Add:

```mdx
import tetris3 from "../../snippets/08-tetris-3-lines.tsx?raw"
```

And a third `<Demo>`:

```mdx
<Demo code={tetris3} />
```

- [ ] **Step 4: Verify in the dev server**

Visit the chapter URL. Test the Stage 3 demo:
- Score panel appears in the top-left corner of the demo.
- Fill a bottom row — when it completes, the row disappears and score increases by 100.
- Clear 2/3/4 lines at once (drop an I-piece vertically into a near-full board) — score increases by 300/500/800 respectively.
- Fill the board until a spawn collides — gravity halts and a "play again" button appears.
- Clicking "play again" resets the board, piece, and score; gravity resumes.

Common pitfalls: if the score panel appears in the wrong corner or is positioned over the wrong demo, the `<Portal>` default container is `document.body`, which means it'll appear in the iframe's body — that's the intended behavior since each `<Demo>` runs in its own iframe. If multi-line clears don't add up, recheck `LINE_SCORES[cleared]`. If `clearLines` removes the wrong rows, recheck the descending-iteration order.

- [ ] **Step 5: Commit**

```bash
git add site/src/snippets/08-tetris-3-lines.tsx site/src/routes/tutorial/08-interactive-scene.mdx
git commit -m "feat(site): add tetris stage 3 snippet (lines + score)"
```

---

## Task 4: Author the new chapter `.mdx` (under temporary filename first)

**Files:**
- Create: `site/src/routes/tutorial/08-tetris.mdx`

We write the new file first, leave the old whack-a-cube chapter alone, and swap them in Task 7. This keeps every commit ship-able.

- [ ] **Step 1: Create the chapter file with full contents**

Write `site/src/routes/tutorial/08-tetris.mdx`:

```mdx
---
title: Tetris
---

import tetris1 from "../../snippets/08-tetris-1-render.tsx?raw"
import tetris2 from "../../snippets/08-tetris-2-fall.tsx?raw"
import tetris3 from "../../snippets/08-tetris-3-lines.tsx?raw"

# Tetris

This chapter is bigger than the others. We're building Tetris across three
demos so you can watch the state grow.

## Stage 1 — Two stores, some JSX

<Demo code={tetris1} />

There's no game here yet — just two stores and JSX that reads them.

- **The board** is a 2D matrix of optional colors, stored with
  `createStore`. We render it with two nested `<Index>` components, one
  per row, one per cell. Empty cells are skipped with `<Show>`.
- **The piece** is a `{ type, shape, position }` store. The `<Tetromino>`
  component reads it and emits one `<Cell>` per filled square in the
  shape, offset by the piece's position.

The two are rendered as **two parallel passes**: the locked board owns
its JSX, the active piece owns its JSX. No merge step — each piece of
state draws itself.

Click any cube of the piece to cycle it through I → O → T → S → Z → J → L
and back. Mutating the store is the only thing that's changing.

## Stage 2 — Gravity and keys

<Demo code={tetris2} />

We added three things:

- A `setInterval` that calls `tryMove(0, 1)` every half-second. That's
  gravity.
- A `keydown` listener on `window`. ← and → move the piece, ↓ soft-drops
  one cell, ↑ rotates, **space** hard-drops to the bottom.
- A `tryMove(dx, dy)` function that checks the new position against the
  board's bounds and locked cells before mutating the piece's position.
  If the move was downward and blocked, it locks the piece into the
  board and spawns the next one.

Notice what isn't here: nothing 3D, nothing `solid-three`-specific. Same
wiring you'd use for a todo app.

## Stage 3 — Lines and score

<Demo code={tetris3} />

Two more additions:

- After every lock, `clearLines()` finds full rows and `splice`s them out
  of the board store inside a `produce`, prepending empties to keep the
  matrix the same shape. The number of rows cleared maps to the classic
  scoring table: 100 / 300 / 500 / 800.
- A `score` signal. A `<Portal>` puts the score panel in the DOM next
  to the canvas. When a fresh piece can't fit at the top, a `<Show>`
  reveals a "play again" button that resets everything.

## The takeaway

Game development is state management. Solid is a state manager that
happens to render `<T.Mesh>`.

Look back at what we built. Every visible cube is a function of two
stores. Every input — a key press, an interval tick, a click — is a
plain function that mutates one of those stores. Solid's job is to
re-render the JSX when state changes; our job is to describe the JSX
and decide when to mutate.

The shape of every other `solid-three` app you'll write is the same as
this one: signals and stores describing state, JSX describing the scene,
the smart-prop pipeline keeping them in sync. The
[API reference](/api) is there when you need a specific export.

If you'd like a peek at where the library is heading next, the encore is
WebGPU.
```

- [ ] **Step 2: Type-check**

Run:
```bash
cd site && pnpm exec tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Verify in the dev server**

Visit `http://localhost:<port>/tutorial/08-tetris` (the URL derives from the filename in this routing setup; if Task 0 found a different scheme, adjust). Confirm:
- The page renders with all three demos in order.
- The Tetris chapter appears in the tutorial sidebar nav. It may appear duplicated alongside "A small game" — that's expected until Task 7.
- The prose reads cleanly; markdown formatting works.

- [ ] **Step 4: Commit**

```bash
git add site/src/routes/tutorial/08-tetris.mdx
git commit -m "docs(site): add tetris chapter page"
```

---

## Task 5: Remove the temporary scaffolding from the old chapter

This restores `08-interactive-scene.mdx` to its pristine state before Task 7 deletes it. Keeps the diff in Task 7 clean.

**Files:**
- Modify: `site/src/routes/tutorial/08-interactive-scene.mdx`

- [ ] **Step 1: Revert the temporary edits**

Run:
```bash
git checkout HEAD~3 -- site/src/routes/tutorial/08-interactive-scene.mdx
```
This restores the file to its state before Task 1 added the temporary `<Demo>` lines. (`HEAD~3` because Tasks 1, 2, 3 each touched it.)

- [ ] **Step 2: Confirm the file matches the original**

Run:
```bash
git diff HEAD~3 -- site/src/routes/tutorial/08-interactive-scene.mdx
```
Expected: no output (the file now matches its state from three commits ago).

- [ ] **Step 3: Verify the old chapter still works**

Visit `http://localhost:<port>/tutorial/08-interactive-scene` and confirm only the whack-a-cube renders (no tetris demos appended).

- [ ] **Step 4: Commit**

```bash
git add site/src/routes/tutorial/08-interactive-scene.mdx
git commit -m "chore(site): remove temporary tetris scaffolding from old chapter"
```

---

## Task 6: Final visual verification of the new chapter

No file changes — this is a verification gate before deletion.

- [ ] **Step 1: Type-check the whole site**

Run:
```bash
cd site && pnpm exec tsc --noEmit
```
Expected: no errors.

- [ ] **Step 2: Run the linter**

Run:
```bash
cd site && pnpm lint
```
If errors come from existing site code unrelated to this chapter, ignore them; if they come from any of the four new files, fix in place and amend the relevant commit (or add a follow-up commit if you prefer non-amending — the repo's convention from memory is "prefer new commits over amend").

- [ ] **Step 3: Manual gameplay walk-through**

Visit `http://localhost:<port>/tutorial/08-tetris` and play through all three demos end-to-end:

| Check | Expected |
|---|---|
| Stage 1: click piece | Cycles I → O → T → S → Z → J → L → I |
| Stage 2: gravity | Falls one cell per ~0.5s |
| Stage 2: ← → | Moves left/right; blocked at walls |
| Stage 2: ↓ | Soft-drops one cell |
| Stage 2: ↑ | Rotates clockwise; blocked into walls |
| Stage 2: space | Hard-drops to floor, locks, spawns |
| Stage 2: game over | Gravity stops, no UI (intended) |
| Stage 3: single-line clear | +100 score, row removed |
| Stage 3: tetris (4 lines) | +800 score |
| Stage 3: game over | "play again" button appears in top-left |
| Stage 3: play again | Board cleared, score reset, gravity resumes |

- [ ] **Step 4: No commit** — verification only.

---

## Task 7: Delete the old chapter and snippet

**Files:**
- Delete: `site/src/routes/tutorial/08-interactive-scene.mdx`
- Delete: `site/src/snippets/08-interactive-scene.tsx`

- [ ] **Step 1: Delete the two files**

Run:
```bash
git rm site/src/routes/tutorial/08-interactive-scene.mdx site/src/snippets/08-interactive-scene.tsx
```

- [ ] **Step 2: Verify nothing references them**

Run:
```bash
grep -rn "08-interactive-scene\|interactive-scene" site/src/ 2>/dev/null
```
Expected: no output. If there are hits (e.g., a manually-maintained tutorial index), update those references to point to `08-tetris` instead, and include them in the same commit.

- [ ] **Step 3: Type-check and lint**

Run:
```bash
cd site && pnpm exec tsc --noEmit && pnpm lint
```
Expected: no errors.

- [ ] **Step 4: Verify in the dev server**

Visit `http://localhost:<port>/tutorial/08-tetris` and confirm it still renders. Visit `http://localhost:<port>/tutorial/08-interactive-scene` and confirm it 404s (the old chapter is gone). Check the tutorial sidebar — only "Tetris" should appear at position 8; the whack-a-cube entry should be gone.

- [ ] **Step 5: Commit**

```bash
git add -u
git commit -m "feat(site): replace whack-a-cube chapter with tetris"
```

---

## Done

The tutorial's chapter 8 is now Tetris, built up across three live demos with the "game development is state management" takeaway as the closer.
