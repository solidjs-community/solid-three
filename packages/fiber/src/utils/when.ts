import { Accessor } from 'solid-js'

type Filter<T> = Exclude<T, null | undefined | false>

export function when<
  const T,
  TAccessors extends Array<Accessor<T> | T>,
  const TValues extends {
    [TKey in keyof TAccessors]: TAccessors[TKey] extends ((...args: any[]) => any) | undefined
      ? Filter<ReturnType<Exclude<TAccessors[TKey], undefined>>>
      : Filter<TAccessors[TKey]>
  },
>(...accessors: TAccessors) {
  function callback<const TResult>(callback: (...values: TValues) => TResult) {
    const values = new Array(accessors.length)

    for (let i = 0; i < accessors.length; i++) {
      const _value = typeof accessors[i] === 'function' ? (accessors[i] as () => T)() : accessors[i]
      if (_value === undefined || _value === null || _value === false) return undefined
      values[i] = _value
    }

    return callback(...(values as any))
  }
  return callback
}

export function all<
  const T,
  TAccessors extends Array<Accessor<T> | T>,
  const TValues extends {
    [TKey in keyof TAccessors]: TAccessors[TKey] extends () => any
      ? Filter<ReturnType<TAccessors[TKey]>>
      : Filter<TAccessors[TKey]>
  },
>(...accessors: TAccessors): TValues | undefined {
  const values = new Array(accessors.length)

  for (let i = 0; i < accessors.length; i++) {
    const _value = typeof accessors[i] === 'function' ? (accessors[i] as () => T)() : accessors[i]
    if (_value === undefined || _value === null || _value === false) return undefined
    values[i] = _value
  }

  return values as TValues
}
