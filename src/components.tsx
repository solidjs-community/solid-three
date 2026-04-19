import {
  Loading,
  Show,
  createMemo,
  merge,
  omit,
  type Accessor,
  type JSX,
  type JSXElement,
  type ParentProps,
} from "solid-js"
import { Loader, Object3D } from "three"
import { SHOULD_DEBUG } from "./constants.ts"
import { threeContext, useLoader, useThree, type UseLoaderOptions } from "./hooks.ts"
import { useProps, useSceneGraph } from "./props.ts"
import type { Constructor, LoaderData, LoaderUrl, Meta, Overwrite, Props } from "./types.ts"
import { type InstanceOf } from "./types.ts"
import {
  autodispose,
  createDebug,
  hasMeta,
  isConstructor,
  meta,
  whenMemo,
  withContext,
  type LoadOutput,
} from "./utils.ts"

const debugPortal = createDebug("components:Portal", SHOULD_DEBUG)
const debugEntity = createDebug("components:Entity", SHOULD_DEBUG)
const debugResource = createDebug("components:Resource", SHOULD_DEBUG)

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
  debugPortal("mount", { target: props.element ? "custom" : "scene" })
  const context = useThree()

  const element = createMemo(() => {
    if (!props.element) {
      debugPortal("element", { source: "scene" })
      return context.scene
    }
    if (hasMeta(props.element)) {
      debugPortal("element", { source: "custom", hasMeta: true })
      return props.element
    }
    debugPortal("element", { source: "custom", hasMeta: false })
    return meta(props.element, { props: {} })
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
          merge(context, {
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

type EntityProps<T extends object | Constructor<object>> = Overwrite<
  [
    Props<T>,
    {
      from: T | undefined
      children?: JSXElement
    },
  ]
>
/**
 * Wraps a `ThreeElement` and allows it to be used as a JSX-component within a `solid-three` scene.
 *
 * @function Entity
 * @template T - Extends `ThreeInstance`
 * @param props - The properties for the Three.js object including the object instance's methods,
 *                                    optional children, and a ref that provides access to the object instance.
 * @returns The Three.js object wrapped as a JSX element, allowing it to be used within Solid's component system.
 */
export function Entity<T extends object | Constructor<object>>(props: EntityProps<T>) {
  debugEntity("mount", {
    fromType: !props.from ? "none" : isConstructor(props.from) ? "constructor" : "instance",
    hasArgs: !!props.args?.length,
  })
  const rest = omit(props, "from", "args")
  const memo = whenMemo(
    () => props.from,
    from => {
      // listen to key changes
      props.key
      if (isConstructor(from)) {
        debugEntity("instance", { via: "constructor", args: props.args?.length ?? 0 })
      } else {
        debugEntity("instance", { via: "existing" })
      }
      const instance = meta(
        isConstructor(from) ? autodispose(new from(...(props.args ?? []))) : from,
        {
          props,
        },
      ) as Meta<T>
      // Apply props (ref, instance properties, onUpdate) inside whenMemo
      // so they are re-created per instance — skipSceneGraph since it's managed below.
      useProps(instance, rest, undefined, { skipSceneGraph: true })
      return instance
    },
  )
  // useSceneGraph is called outside whenMemo so that children (scene graph) persist
  // when `from` changes — the same child instances are re-attached to the new parent
  // rather than being destroyed and recreated.
  // @ts-expect-error TODO: fix type — onUpdate signature mismatch between EntityProps and useSceneGraph
  useSceneGraph(memo, rest)
  return memo as unknown as JSX.Element
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
  Omit<Props<LoaderData<TLoader>>, "children"> & {
    loader: Constructor<TLoader>
    url: LoaderUrl<TLoader>
    children?: (result: Accessor<LoadOutput<TLoader, LoaderUrl<TLoader>>>) => JSXElement
  }

/**
 * A component for loading Three.js resources (textures, models, etc.) with automatic caching and Loading boundary integration.
 *
 * The Resource component wraps the `useLoader` hook in a declarative component API, making it easy to load
 * and use Three.js assets within your scene. It integrates with Solid's Loading boundary for handling loading states.
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
  debugResource("mount", {
    urlShape:
      typeof props.url === "string" ? "string" : Array.isArray(props.url) ? "array" : "record",
    hasRenderFn: "children" in props,
  })
  const rest = omit(props, "base", "cache", "onBeforeLoad", "onLoad", "loader", "url", "children")

  const resource = useLoader(
    () => props.loader,
    () => props.url,
    {
      get base() {
        return props.base
      },
      get cache() {
        return props.cache
      },
      get onBeforeLoad() {
        return props.onBeforeLoad
      },
      get onLoad() {
        return props.onLoad
      },
    },
  )

  useProps(resource, rest)

  return (
    <Loading>
      <Show
        when={"children" in props && resource()}
        fallback={resource() as unknown as JSX.Element}
      >
        {r => props.children?.(r)}
      </Show>
    </Loading>
  )
}
