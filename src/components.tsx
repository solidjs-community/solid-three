import {
  type Accessor,
  type JSX,
  type JSXElement,
  type ParentProps,
  Show,
  createMemo,
  createResource,
  mergeProps,
  splitProps,
} from "solid-js"
import { Object3D } from "three"
import { threeContext, useThree } from "./hooks.ts"
import { useProps } from "./props.ts"
import type { Constructor, InferPluginProps, Loader, Meta, Plugin, Props } from "./types.ts"
import { type InstanceOf } from "./types.ts"
import { autodispose, hasMeta, isConstructor, load, meta, withContext } from "./utils.ts"
import { whenMemo } from "./utils/conditionals.ts"

/**********************************************************************************/
/*                                                                                */
/*                                     Portal                                     */
/*                                                                                */
/**********************************************************************************/

type PortalProps<T extends Object3D> = ParentProps<{
  element?: InstanceOf<T> | Meta<T>
  onUpdate?(value: T): void
}>
/**
 * A component for placing its children outside the regular `solid-three` scene graph managed by Solid's reactive system.
 * This is useful for bypassing the normal rendering flow and manually managing children, similar to Solid's Portal but specific to `solid-three`.
 *
 * @function Portal
 * @param props - The component props containing `children` to be rendered and an optional Object3D `element` to be rendered into.
 * @returns An empty JSX element.
 */
export function Portal<T extends Object3D>(props: PortalProps<T>) {
  const context = useThree()

  const element = createMemo(() => {
    return props.element
      ? hasMeta(props.element)
        ? props.element
        : meta(props.element, { props: {} })
      : context.scene
  })

  useProps(element, {
    get onUpdate() {
      return props.onUpdate
    },
    get children() {
      return () =>
        withContext(
          () => props.children as unknown as Meta | Meta[],
          // @ts-expect-error TODO: fix type-error
          threeContext,
          mergeProps(context, {
            get scene() {
              return element()
            },
          }),
        )
    },
  })

  return null
}

/**********************************************************************************/
/*                                                                                */
/*                                     Entity                                     */
/*                                                                                */
/**********************************************************************************/

/**
 * Wraps a `ThreeElement` and allows it to be used as a JSX-component within a `solid-three` scene.
 *
 * @function Entity
 * @template T - Extends `ThreeInstance`
 * @param props - The properties for the Three.js object including the object instance's methods,
 *                                    optional children, and a ref that provides access to the object instance.
 * @returns The Three.js object wrapped as a JSX element, allowing it to be used within Solid's component system.
 */
export function Entity<
  const T extends object | Constructor<object> = object,
  const TPlugins extends Plugin[] = $3.Plugins,
>(
  props:
    | Props<T>
    | { from: T; children?: JSXElement; plugins?: TPlugins }
    | InferPluginProps<TPlugins>,
) {
  const [config, rest] = splitProps(props, ["from", "args"])
  const memo = whenMemo(
    () => config.from,
    from => {
      // listen to key changes
      props.key
      const instance = meta(
        isConstructor(from) ? autodispose(new from(...(config.args ?? []))) : from,
        {
          props,
          get plugins() {
            return props.plugins
          },
        },
      ) as Meta<T>
      useProps(instance, rest)
      return instance
    },
  )
  return memo as unknown as JSX.Element
}

/**********************************************************************************/
/*                                                                                */
/*                                     Resource                                   */
/*                                                                                */
/**********************************************************************************/

type ResourceProps<TSource, TResult extends object> = Omit<Props<TResult>, "children"> & {
  loader: new () => Loader<TSource, TResult>
  url: TSource
  path?: string
  children?: (result: Accessor<TResult>) => JSXElement
}

export function Resource<TSource extends string | string[], TResult extends object>(
  props: ResourceProps<TSource, TResult>,
) {
  const [config, rest] = splitProps(props, ["loader", "path", "url"])
  const loader = createMemo(() => new config.loader())
  const [resource] = createResource(
    () => [config.url, loader(), config.path] as const,
    ([url, loader, path]) => {
      loader.setPath?.(path ?? "")
      return load(loader, url)
    },
  )
  return (
    <Show
      when={"children" in props && resource()}
      // @ts-expect-error FIXME
      fallback={<Entity from={resource()} {...rest} />}
    >
      {resource => props.children?.(resource)}
    </Show>
  )
}
