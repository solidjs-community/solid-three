import { createContext } from 'solid-js'
import { UseBoundStore } from './zustand'
import { RootState } from '../core/store'
import { StoreApi } from 'zustand/vanilla'

export const context = createContext<UseBoundStore<RootState, StoreApi<RootState>> | null>(null)
