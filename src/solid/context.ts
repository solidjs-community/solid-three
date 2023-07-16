import { createContext } from 'solid-js'

import type { RootState } from './store'

export const context = createContext<RootState | null>(null)
