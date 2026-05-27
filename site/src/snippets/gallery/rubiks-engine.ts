export type Axis = "x" | "y" | "z"
export type Layer = -1 | 1
export type Dir = 1 | -1

export interface Move {
  axis: Axis
  layer: Layer
  dir: Dir
}

export interface CubieState {
  id: number
  // Logical integer position in [-1, 0, 1]^3.
  position: [number, number, number]
  // Orientation as a unit quaternion [x, y, z, w].
  orientation: [number, number, number, number]
}

export function initialCubies(): CubieState[] {
  const cubies: CubieState[] = []
  let id = 0
  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        cubies.push({ id: id++, position: [x, y, z], orientation: [0, 0, 0, 1] })
      }
    }
  }
  return cubies
}

export function cubiesOnLayer(state: CubieState[], move: Move): CubieState[] {
  const axisIndex = move.axis === "x" ? 0 : move.axis === "y" ? 1 : 2
  return state.filter(cubie => cubie.position[axisIndex] === move.layer)
}

// Rotate a 3-vector 90° around an axis in `dir` direction (right-handed).
function rotateVec(
  v: [number, number, number],
  axis: Axis,
  dir: Dir,
): [number, number, number] {
  const [x, y, z] = v
  if (axis === "x") return [x, -dir * z, dir * y]
  if (axis === "y") return [dir * z, y, -dir * x]
  return [-dir * y, dir * x, z]
}

// Multiply two unit quaternions: a * b. Order is "apply b, then a".
function quatMul(
  a: [number, number, number, number],
  b: [number, number, number, number],
): [number, number, number, number] {
  const [ax, ay, az, aw] = a
  const [bx, by, bz, bw] = b
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ]
}

function quatFromAxisAngle(
  axis: Axis,
  angle: number,
): [number, number, number, number] {
  const s = Math.sin(angle / 2)
  const c = Math.cos(angle / 2)
  if (axis === "x") return [s, 0, 0, c]
  if (axis === "y") return [0, s, 0, c]
  return [0, 0, s, c]
}

export function applyMove(state: CubieState[], move: Move): CubieState[] {
  const angle = (move.dir * Math.PI) / 2
  const turnQuat = quatFromAxisAngle(move.axis, angle)
  const axisIndex = move.axis === "x" ? 0 : move.axis === "y" ? 1 : 2
  return state.map(cubie => {
    if (cubie.position[axisIndex] !== move.layer) return cubie
    return {
      ...cubie,
      position: rotateVec(cubie.position, move.axis, move.dir),
      orientation: quatMul(turnQuat, cubie.orientation),
    }
  })
}

export function invertMove(move: Move): Move {
  return { ...move, dir: (-move.dir) as Dir }
}

export function generateScramble(count: number, rng: () => number = Math.random): Move[] {
  const axes: Axis[] = ["x", "y", "z"]
  const layers: Layer[] = [-1, 1]
  const dirs: Dir[] = [-1, 1]
  const moves: Move[] = []
  let last: Axis | undefined
  for (let i = 0; i < count; i++) {
    let axis: Axis
    do {
      axis = axes[Math.floor(rng() * 3)]
    } while (axis === last)
    last = axis
    const layer = layers[Math.floor(rng() * 2)]
    const dir = dirs[Math.floor(rng() * 2)]
    moves.push({ axis, layer, dir })
  }
  return moves
}
