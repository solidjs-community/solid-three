import { createContext } from 'solid-js'
import { RootState } from '../core/store'

export const context = createContext<RootState | null>(null)
