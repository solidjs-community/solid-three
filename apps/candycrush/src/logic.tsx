import { SetStoreFunction } from 'solid-js/store'
import { AMOUNT, COLORS, Color, DELAY, GameState, Matrix, Vector } from './App'

export const createCellState = () => {
  const index = Math.floor(Math.random() * COLORS.length)
  return COLORS[index]
}

export const createGameState = (rows: number, columns: number) => {
  const state: Matrix<Color | undefined> = []
  for (let i = 0; i < rows; i++) {
    state.push([])
    for (let j = 0; j < columns; j++) {
      state[i].push(createCellState())
    }
  }
  return state
}

const getMatches = (state: GameState) => {
  const step = (position: Vector, direction: Vector, amount = 1) => {
    const [row, column] = [position[0] + direction[0], position[1] + direction[1]]
    const value = state[row]?.[column]
    return value ? { value, position: [row, column] as [number, number] } : undefined
  }
  const evaluateDirection = ([row, column]: Vector, direction: Vector) => {
    const current = state[row][column]
    const matches: [number, number][] = [[row, column]]
    while (true) {
      const latest = matches[matches.length - 1]
      const next = step(latest, direction)
      if (next && next.value === current) matches.push(next.position)
      else break
    }
    return matches.length >= 3 ? matches : []
  }
  const evaluateCell = ([row, column]: Vector) => {
    const right = [0, 1] as [number, number]
    const bottom = [1, 0] as [number, number]
    const matches = []
    matches.push(...evaluateDirection([row, column], right))
    matches.push(...evaluateDirection([row, column], bottom))
    return matches
  }
  return Array.from(new Set(state.flatMap((row, i) => row.flatMap((_, j) => evaluateCell([i, j])))))
}

const dropGems = (state: GameState) =>
  state.map((_, row) => {
    let segments: Color[][] = [[]]
    let column = 0
    while (column < AMOUNT) {
      const next = state[row][column]
      if (next) {
        segments[segments.length - 1].push(next)
      } else {
        if (segments[segments.length - 1].length > 0) segments.push([])
      }
      column++
    }
    return segments.flatMap((v) => v)
  })

const fillBoard = (state: GameState) => {
  const temp = state.map((row) => [...row])
  for (let i = 0; i < AMOUNT; i++) {
    for (let j = 0; j < AMOUNT; j++) {
      if (!temp[i][j]) {
        temp[i][j] = createCellState()
      }
    }
  }
  return temp
}

const wait = (duration = 1000) => new Promise((resolve) => setTimeout(resolve, duration))

export const evaluateState = async (
  state: GameState,
  setState: SetStoreFunction<GameState>,
  addToScore: (points: number) => void,
) => {
  // STAGE 1:   get and remove matches
  const matches = getMatches(state)
  if (matches.length === 0) return
  addToScore(matches.length)
  const temp = state.map((arr) => [...arr]) as GameState
  matches.forEach(([row, column]) => (temp[row][column] = undefined))
  setState(temp)
  await wait(DELAY)
  // STAGE 2:   let gravity do its work and drop gems
  setState(dropGems(state))
  await wait(DELAY)
  // STAGE 3:   fill missing elements with new gems
  setState(fillBoard(state))
  await wait(DELAY)
  evaluateState(state, setState, addToScore)
}
