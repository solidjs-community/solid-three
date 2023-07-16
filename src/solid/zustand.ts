import { Accessor, createSignal, onCleanup } from 'solid-js'
import type { StateCreator, StoreApi } from 'zustand/vanilla'
import createZustandStore from 'zustand/vanilla'

type ExtractState<S> = S extends { getState: () => infer T } ? T : never

export function useStore<T extends object, S extends StoreApi<T>>(api: S): ExtractState<S>
export function useStore<T extends object, S extends StoreApi<T>, U>(
  api: S,
  selector?: (state: ExtractState<S>) => U,
  equalityFn?: (a: U, b: U) => boolean,
): Accessor<U>

export function useStore<TState extends object, StateSlice>(
  api: StoreApi<TState>,
  selector: (state: TState) => StateSlice = api.getState as any,
  equalityFn?: (a: StateSlice, b: StateSlice) => boolean,
) {
  const initialValue = selector(api)
  const [state, setState] = createSignal(initialValue)

  const listener = (nextState: TState, previousState: TState) => {
    const prevStateSlice = selector(previousState)
    const nextStateSlice = selector(nextState)

    if (equalityFn !== undefined) {
      if (!equalityFn(prevStateSlice, nextStateSlice)) setState(() => nextStateSlice)
    } else {
      setState(() => nextStateSlice)
    }
  }

  const unsubscribe = api.subscribe(listener)
  onCleanup(() => unsubscribe())
  return state
}

export type UseBoundStore<T extends Object, S extends StoreApi<T>> = {
  (): ExtractState<S>
  <U>(selector: (state: ExtractState<S>) => U, equals?: (a: U, b: U) => boolean): U
} & S

interface Create {
  // <T extends object, Mos extends [StoreMutatorIdentifier, unknown][] = []>(
  //   initializer: StateCreator<T, [], Mos>,
  // ): UseBoundStore<T, Mutate<StoreApi<T>, Mos>>
  // <T extends object>(): <Mos extends [StoreMutatorIdentifier, unknown][] = []>(
  //   initializer: StateCreator<T, [], Mos>,
  // ) => UseBoundStore<T, Mutate<StoreApi<T>, Mos>>
  <T extends object, S extends StoreApi<T>>(store: S): UseBoundStore<T, S>
}

const createImpl = <T extends object>(createState: StateCreator<T, [], []> | StoreApi<T>) => {
  const api: StoreApi<T> = typeof createState === 'function' ? createZustandStore(createState) : createState

  const useBoundStore: any = function <S extends StoreApi<T>, U>(
    selector?: (state: T) => U,
    equalityFn?: (a: U, b: U) => boolean,
  ) {
    return useStore<T, StoreApi<T>, U>(api, selector, equalityFn)
  }

  Object.assign(useBoundStore, api)

  return useBoundStore
}

const create = (<T extends object>(createState: StoreApi<T> | undefined) =>
  createState ? createImpl(createState) : createImpl) as Create

export default create
