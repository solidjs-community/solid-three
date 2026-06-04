import {
  Show,
  createMemo,
  mergeProps,
  splitProps,
  type Accessor,
  type JSX,
  type JSXElement,
  type ParentProps,
} from "solid-js"
import { Loader, Object3D } from "three"
import { threeContext, useLoader, useThree, type UseLoaderOptions } from "./hooks.ts"
import { useProps } from "./props.ts"
import type { BaseProps, Constructor, LoaderData, LoaderUrl, Meta, Plugin, Props } from "./types.ts"
import { type InstanceOf } from "./types.ts"
import { autodispose, hasMeta, isConstructor, meta, withContext, type LoadOutput } from "./utils.ts"

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
 * The `& PropsWithPlugins<T, TPlugins>` intersection + `const TPlugins` is what lets
 * the JSX `plugins` array const-infer into a tuple, so a per-element plugin's
 * contributed methods surface as typed (and enforced) props.
 *
 * @param props - The Three.js object's props (methods, children, ref) plus the
 *                element-scoped `plugins` and their contributed props.
 * @returns The Three.js object wrapped as a JSX element.
 */
export function Entity<
  const T extends object | Constructor<object> = object,
  const TPlugins extends readonly Plugin[] = readonly Plugin[],
>(
  // PropsWithPlugins keeps PluginPropsOf a direct top-level intersection (not buried in
  // Props's Overwrite) so TPlugins stays inferable from the JSX `plugins` prop.
  props: { from: T; children?: JSXElement; plugins?: TPlugins } & Props<T, TPlugins>,
) {
  // `plugins` is split out of `rest` so it isn't applied to the three instance;
  // its contributed methods are resolved once (gated) inside useProps.
  const [config, rest] = splitProps(props as any, ["from", "args", "plugins"])
  const instance = createMemo(() => {
    const from = config.from
    if (!from)
      return undefined
      // track key changes to force reconstruction
    ;(props as any).key
    return meta(isConstructor(from) ? autodispose(new from(...(config.args ?? []))) : from, {
      props,
    }) as Meta<T>
  })
  useProps(instance, rest, undefined, config.plugins ? [...config.plugins] : [])
  return instance as unknown as JSX.Element
}

/**********************************************************************************/
/*                                                                                */
/*                                     Resource                                   */
/*                                                                                */
/**********************************************************************************/

type ResourceProps<TLoader extends Loader<object, any>> = UseLoaderOptions<
  TLoader,
  LoaderUrl<TLoader>
> &
  Omit<BaseProps<LoaderData<TLoader>>, "children"> & {
    loader: Constructor<TLoader>
    url: LoaderUrl<TLoader>
    children?: (result: Accessor<LoadOutput<TLoader, LoaderUrl<TLoader>>>) => JSXElement
  }

/**
 * A component for loading Three.js resources (textures, models, etc.) with automatic caching and Suspense integration.
 *
 * The Resource component wraps the `useLoader` hook in a declarative component API, making it easy to load
 * and use Three.js assets within your scene. It integrates with Solid's Suspense system for handling loading states.
 *
 * When no children prop is provided, Resource automatically renders the loaded resource as an Entity,
 * passing through any additional props to the loaded object. This allows for direct property assignment
 * and attachments.
 *
 * @template TLoader The Three.js loader type (e.g., TextureLoader, GLTFLoader)
 * @template TUrl The URL input type - depends on what the loader expects (string, string[], or record)
 *
 * @param props - Configuration object
 * @param props.loader - Three.js loader constructor (e.g., TextureLoader, GLTFLoader)
 * @param props.url - URL(s) to load - can be a string, array of strings, or object mapping keys to URLs
 * @param props.children - Optional render function that receives the loaded resource
 * @param props.base - Base URL for resolving relative paths
 * @param props.cache - Caching behavior: true (default), false, or custom LoaderRegistry instance
 * @param props.onBeforeLoad - Callback executed before loading starts
 * @param props.onLoad - Callback executed after successful loading
 * @param props.* - Any additional props are passed to the loaded resource when children is not provided
 *
 * @returns JSX element that renders the loaded resource
 *
 * @example
 * ```tsx
 * // Texture automatically attached to parent material
 * <T.MeshStandardMaterial>
 *   <Resource loader={TextureLoader} url="texture.jpg" attach="map" />
 *   <Resource loader={TextureLoader} url="normal.jpg" attach="normalMap" />
 * </T.MeshStandardMaterial>
 *
 * // Model with transform props passed directly
 * <Resource
 *   loader={GLTFLoader}
 *   url="model.gltf"
 *   scale={2}
 *   position={[0, 1, 0]}
 *   rotation={[0, Math.PI, 0]}
 * />
 *
 * // Custom handling with render function
 * <Resource loader={TextureLoader} url="texture.jpg">
 *   {texture => (
 *     <T.Mesh>
 *       <T.BoxGeometry />
 *       <T.MeshBasicMaterial map={texture()} />
 *     </T.Mesh>
 *   )}
 * </Resource>
 * ```
 */
export function Resource<const TLoader extends Loader<object, any>>(props: ResourceProps<TLoader>) {
  const [options, config, rest] = splitProps(
    props,
    ["base", "cache", "onBeforeLoad", "onLoad"],
    ["loader", "url", "children"],
  )

  const resource = useLoader(
    () => config.loader,
    () => config.url,
    options,
  )

  // Tag the loaded resource with meta so the surrounding scene graph can read
  // `attach` (and other meta-driven props) off it when this component is
  // rendered as a JSX child.
  const tagged = createMemo(() => {
    const value = resource()
    if (!value || typeof value !== "object") return value
    return hasMeta(value) ? value : meta(value as object, { props })
  })

  useProps(tagged, rest)

  return (
    <Show when={"children" in config && tagged()} fallback={tagged() as JSX.Element}>
      {value => props.children?.(value as Accessor<LoadOutput<TLoader, LoaderUrl<TLoader>>>)}
    </Show>
  )
}
