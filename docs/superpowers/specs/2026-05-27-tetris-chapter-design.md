# Tutorial ch.8 — Tetris (replace whack-a-cube) — design

The tutorial's current "small game" chapter (`08-interactive-scene.mdx`) is a
~150-line whack-a-cube. Replace it with a Tetris that is built across three
live demos on a single page: render → fall + keys → lines. The chapter's
takeaway is the line every reader should leave with:

> Game development is state management. Solid is a state manager that happens
> to render `<T.Mesh>`.

## Goals

- **One page, three runnable demos.** Each stage is a self-contained snippet
  that compiles and runs in the existing `<Demo>` component.
- **Pure-Solid mental model.** Two stores (`board`, `piece`) and a few
  signals. No drei `KeyboardControls`, no `useCubeTexture`, no `createStore`
  helpers beyond what's already in solid-js.
- **Reads as a clear diff between stages.** Stage 2 is "Stage 1 plus
  gravity and keys." Stage 3 is "Stage 2 plus line-clearing and score."
  A reader who has internalised stage 1 should understand stage 3 by reading
  the additions.

## Non-goals

- Cube textures, env-maps, soft-drop, hard-drop, hold/swap, levels, ghost
  piece, T-spins, wall kicks. The original (`apps/tetris` at commit
  `f3374cf`) is the maximalist version; this chapter is the lean teaching
  version.
- A separate "intermediate" between any of the three stages.
- Persisting high scores or any state across reloads.

## File plan

- **Replace** `site/src/routes/tutorial/08-interactive-scene.mdx`
  → rename to `site/src/routes/tutorial/08-tetris.mdx`.
- **Add** `site/src/snippets/08-tetris-1-render.tsx`.
- **Add** `site/src/snippets/08-tetris-2-fall.tsx`.
- **Add** `site/src/snippets/08-tetris-3-lines.tsx`.
- **Delete** `site/src/snippets/08-interactive-scene.tsx`.

Whether other routing/index files need to update for the rename is a
question for the implementation step — see Open questions for the route.

## Shared model (used by all three stages)

```ts
const WIDTH = 10
const HEIGHT = 20

type Color = 'cyan' | 'yellow' | 'purple' | 'green' | 'red' | 'blue' | 'orange'
type Cell = Color | undefined

const TETROMINOES = {
  I: { color: 'cyan',   shape: [[1,1,1,1]] },
  O: { color: 'yellow', shape: [[1,1],[1,1]] },
  T: { color: 'purple', shape: [[0,1,0],[1,1,1]] },
  S: { color: 'green',  shape: [[0,1,1],[1,1,0]] },
  Z: { color: 'red',    shape: [[1,1,0],[0,1,1]] },
  J: { color: 'blue',   shape: [[1,0,0],[1,1,1]] },
  L: { color: 'orange', shape: [[0,0,1],[1,1,1]] },
} as const
type TetrominoType = keyof typeof TETROMINOES

type Piece = {
  type: TetrominoType
  shape: number[][]  // rotated copy
  position: [x: number, y: number]
}
```

- **Board store**: `createStore<Cell[][]>(emptyBoard())` where
  `emptyBoard()` returns `HEIGHT` rows × `WIDTH` columns of `undefined`.
  Indexed as `board[y][x]` (row-major; y grows downward).
- **Piece store**: `createStore<Piece>(spawn())`.
- **Cell component**: a `<T.Mesh>` containing `<T.BoxGeometry>` and
  `<T.MeshStandardMaterial color={…} />`. No textures, no env-map. (The
  codebase uses plain `solid-three` primitives via `createT(THREE)`; no
  `@solid-three/drei`.)
- **Tetromino component**: takes `piece` and renders one `Cell` per filled
  square in `piece.shape`, offset by `piece.position`.
- **Two parallel renders** (the punchline):

  ```tsx
  <Index each={board}>{(row, y) =>
    <Index each={row()}>{(color, x) =>
      <Show when={color()}>
        <Cell x={x} y={y} color={color()!} />
      </Show>
    }</Index>
  }</Index>
  <Tetromino piece={piece} />
  ```

- **Camera**: orthographic, front-on, sized to frame the 10×20 grid with a
  little margin. Lights: one directional + one ambient.

## Stage 1 — `08-tetris-1-render.tsx` (~70 lines)

**Goal**: "The board is a store, a piece is a store, here's the JSX."

Behaviour:
- Empty board.
- One piece, initially `T` centered horizontally somewhere mid-board.
- Clicking any cube of the active piece cycles `piece.type` through the 7
  shapes (using `event.stopPropagation()` and a `useFrame`-free handler).
  This is the only interaction. It exercises pointer events from ch.4 and
  proves that mutating the piece store re-renders the scene.

Shows in code:
- `TETROMINOES` table.
- `createStore` for `board` and `piece` (the chapter's first store).
- `Cell`, `Tetromino`, and the two parallel renders.
- A `cycleType()` helper called from `onClick`.

Out of scope: gravity, collision, keyboard, multiple pieces.

## Stage 2 — `08-tetris-2-fall.tsx` (~120 lines)

**Goal**: "Add gravity and keys. Both are plain Solid wiring."

Adds, on top of Stage 1:

- **Gravity**: `setInterval(() => tryMove(0, 1), 500)` in `onMount`, cleared
  in `onCleanup`. Click-to-cycle from Stage 1 is removed (a falling piece
  doesn't cycle).
- **Keyboard**: `onMount` registers a `window.addEventListener('keydown', …)`,
  removed in `onCleanup`. Bindings:
  - `ArrowLeft` / `ArrowRight` → `tryMove(±1, 0)`.
  - `ArrowDown` → `tryMove(0, 1)` (one-cell soft-drop; no auto-repeat
    handling beyond the OS default).
  - `ArrowUp` → `tryRotate()`.
  - `Space` → `hardDrop()`: call `tryMove(0, 1)` in a loop until it
    fails, then `lock()` + `spawn()` (same path as a downward collision
    in the gravity tick). Prevent the page from scrolling
    (`event.preventDefault()` when the key matches).
- **`tryMove(dx, dy)`**:
  1. Compute next position.
  2. For every filled square in `piece.shape`, check `x<0 || x>=WIDTH ||
     y>=HEIGHT || board[y][x]`. (No top-bound check — pieces spawn above
     the visible board is out of scope for stage 2; pieces spawn at y=0.)
  3. If clear, `setPiece('position', [nx, ny])`. If clear and direction was
     down, return `'moved'`; if blocked and direction was down, `lock()`
     then `spawn()`.
- **`tryRotate()`**: compute a 90°-rotated copy of `piece.shape`, test it
  at the current position, set it if clear. (No wall-kicks.)
- **`lock()`**: in a `batch`, write each filled square of `piece.shape` into
  the board store via `setBoard(y, x, piece.color)`.
- **`spawn()`**: pick a random tetromino, position it at `[Math.floor((WIDTH
  - shape[0].length) / 2), 0]`. If the spawn position collides, call
  `clearInterval` on the gravity timer (effectively "game over": board
  freezes, no UI). Stage 3 makes this a proper game-over with restart.

Shows in code: `onMount` + `onCleanup` for both timer and listener; the
explicit bounds-and-collision check; per-cell store writes in a `batch`.

Out of scope: line-clearing, score, game-over UI.

## Stage 3 — `08-tetris-3-lines.tsx` (~160 lines)

**Goal**: "Lines and score. Same wiring, two more functions."

Adds, on top of Stage 2:

- **`clearLines()`**, called after every `lock()`:
  1. Find every `y` where `board[y].every(c => c !== undefined)`.
  2. In a single `setBoard(produce(rows => { … }))` call, iterate the
     matched `y`s in **descending order** (so each splice doesn't shift
     the indices of remaining matches), and for each: `rows.splice(y, 1);
     rows.unshift(emptyRow())`. The `produce` wrapper from
     `solid-js/store` is imported here.
  3. Return the number of lines cleared.
- **Score**: `const [score, setScore] = createSignal(0)`. After `clearLines()`,
  add to score using the classic NES table:
  - 1 line → 100
  - 2 lines → 300
  - 3 lines → 500
  - 4 lines → 800
  No level multiplier (we don't have levels).
- **Score panel**: a small DOM overlay rendered via `<Portal>` (from
  `solid-js/web`) positioned top-left of the demo iframe. Reads `score()`.
- **Game-over UX**: a `const [playing, setPlaying] = createSignal(true)`
  signal. When `spawn()` collides, `setPlaying(false)`. A `<Show
  when={!playing()}>` in the Portal renders a "Play again" button which
  calls a `reset()` that:
  - Replaces `board` with a fresh empty matrix.
  - Replaces `piece` with a fresh spawn.
  - `setScore(0)` and `setPlaying(true)`.
  Gravity-timer guard: the interval callback should early-return if
  `!playing()` so the timer can keep running across reset without
  re-registration.

Out of scope: levels, soft/hard-drop scoring, line-clear animation, sound.

## Prose arc (the chapter's `.mdx`)

The chapter is the place where the punchline lives. Approximate beats:

1. **Intro**: "This one's bigger than the others. We're building Tetris in
   three passes so you can watch the state grow."
2. **Stage 1 demo + walk-through**: "There's no game here yet — just two
   stores and JSX that reads them. That's the whole rendering model. The
   board is a 2D array; the piece is a position plus a shape. Click the
   piece to cycle it — mutating the store is the only thing that changed."
3. **Stage 2 demo + walk-through**: "We added a `setInterval` for gravity,
   a `keydown` listener for input, and a `tryMove` that checks bounds and
   the board before mutating the piece's position. None of that is 3D —
   it's the same wiring you'd write for a todo app."
4. **Stage 3 demo + walk-through**: "Line-clearing is `splice` on a row of
   the board store. Score is a signal. The Portal puts the score panel in
   the DOM next to the canvas."
5. **Outro (the takeaway)**: "Game development is state management. Solid
   is a state manager that happens to render `<T.Mesh>`. The shape of every
   game you'll write in `solid-three` is the same as this one: signals and
   stores describing state, JSX describing the scene, smart props keeping
   them in sync."

## Open questions for the implementation step

- **Route file rename.** Rename `08-interactive-scene.mdx` → `08-tetris.mdx`?
  Need to check whether the tutorial nav/index reads filenames or front-matter
  titles. If it reads filenames, the rename is a one-line nav change; if it
  reads front-matter, the rename is silent.
- **Demo iframe height.** Tetris is taller than wide. The `<Demo>` component
  may need a taller default for this chapter, or each snippet may need to
  set its own canvas height. Decide during implementation by trying it.
- **Random seed**. Not seeded. Acceptable for a tutorial demo.
