import { createContext } from 'solid-js'

import type { RootState } from '../core/store'

export const context = createContext<RootState | null>(null)
