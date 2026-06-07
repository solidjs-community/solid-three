import { createSignal } from "solid-js"
import * as THREE from "three"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useLoader } from "../../src/index.ts"
import { LoaderCache } from "../../src/data-structure/loader-cache.ts"
import { test } from "../../src/testing/index.tsx"
import { asyncUtils } from "../utils/async-utils.ts"

/**********************************************************************************/
/*                                                                                */
/*                                 Mock Loader                                    */
/*                                                                                */
/**********************************************************************************/

class MockResource {
  constructor(public readonly url: string) {}
  dispose = vi.fn()
}

class MockLoader extends THREE.Loader {
  load(
    url: string,
    onLoad: (result: MockResource) => void,
    _onProgress?: (event: ProgressEvent) => void,
    _onError?: (event: unknown) => void,
  ) {
    onLoad(new MockResource(url))
  }
}

/**********************************************************************************/
/*                                                                                */
/*                                 Async helpers                                  */
/*                                                                                */
/**********************************************************************************/

const resolvers: (() => void)[] = []
const { waitFor } = asyncUtils(resolver => resolvers.push(resolver))

/**********************************************************************************/
/*                                                                                */
/*                                   Tests                                        */
/*                                                                                */
/**********************************************************************************/

beforeEach(() => {
  useLoader.cache = new LoaderCache()
})

afterEach(() => {
  useLoader.cache = new LoaderCache()
})

describe("useLoader", () => {
  it("returns the loaded resource", async () => {
    let resource: (() => MockResource | undefined) | undefined

    function Component() {
      resource = useLoader(MockLoader, "texture.png") as () => MockResource | undefined
      return null
    }

    test(() => <Component />)

    await waitFor(() => resource?.() !== undefined)

    expect(resource?.()).toBeInstanceOf(MockResource)
    expect(resource?.()?.url).toBe("texture.png")
  })

  it("caches the resource — same loader and URL return the same instance", async () => {
    let first: (() => MockResource | undefined) | undefined
    let second: (() => MockResource | undefined) | undefined

    function Component() {
      first = useLoader(MockLoader, "texture.png") as () => MockResource | undefined
      second = useLoader(MockLoader, "texture.png") as () => MockResource | undefined
      return null
    }

    test(() => <Component />)

    await waitFor(() => first?.() !== undefined && second?.() !== undefined)

    expect(first?.()).toBeDefined()
    expect(second?.()).toBeDefined()
    expect(first?.()).toBe(second?.())
  })

  it("returns distinct instances for different URLs", async () => {
    let first: (() => MockResource | undefined) | undefined
    let second: (() => MockResource | undefined) | undefined

    function Component() {
      first = useLoader(MockLoader, "a.png") as () => MockResource | undefined
      second = useLoader(MockLoader, "b.png") as () => MockResource | undefined
      return null
    }

    test(() => <Component />)

    await waitFor(() => first?.() !== undefined && second?.() !== undefined)

    expect(first?.()?.url).toBe("a.png")
    expect(second?.()?.url).toBe("b.png")
    expect(first?.()).not.toBe(second?.())
  })

  it("reloads when the URL changes reactively", async () => {
    const [url, setUrl] = createSignal("first.png")
    let resource: (() => MockResource | undefined) | undefined

    function Component() {
      resource = useLoader(MockLoader, url) as () => MockResource | undefined
      return null
    }

    test(() => <Component />)

    await waitFor(() => resource?.()?.url === "first.png")

    setUrl("second.png")

    await waitFor(() => resource?.()?.url === "second.png")

    expect(resource?.()?.url).toBe("second.png")
  })

  it("bypasses the cache when cache: false", async () => {
    let first: (() => MockResource | undefined) | undefined
    let second: (() => MockResource | undefined) | undefined

    function Component() {
      first = useLoader(MockLoader, "texture.png", { cache: false }) as () => MockResource | undefined
      second = useLoader(MockLoader, "texture.png", { cache: false }) as () => MockResource | undefined
      return null
    }

    test(() => <Component />)

    await waitFor(() => first?.() !== undefined && second?.() !== undefined)

    expect(first?.()).toBeDefined()
    expect(second?.()).toBeDefined()
    expect(first?.()).not.toBe(second?.())
  })

  it("calls onLoad callback after the resource is loaded", async () => {
    const handleLoad = vi.fn()
    let resource: (() => MockResource | undefined) | undefined

    function Component() {
      resource = useLoader(MockLoader, "texture.png", { onLoad: handleLoad }) as () => MockResource | undefined
      return null
    }

    test(() => <Component />)

    await waitFor(() => resource?.() !== undefined)

    expect(handleLoad).toHaveBeenCalledTimes(1)
    expect(handleLoad).toHaveBeenCalledWith(expect.objectContaining({ url: "texture.png" }))
  })

  it("loads a record of URLs and returns a matching record of resources", async () => {
    let resource: (() => Record<string, MockResource> | undefined) | undefined

    function Component() {
      resource = useLoader(MockLoader, { diffuse: "diffuse.png", normal: "normal.png" }) as () =>
        Record<string, MockResource> | undefined
      return null
    }

    test(() => <Component />)

    await waitFor(() => resource?.()?.diffuse !== undefined && resource()?.normal !== undefined)

    expect(resource?.()?.diffuse).toBeInstanceOf(MockResource)
    expect(resource?.()?.normal).toBeInstanceOf(MockResource)
    expect(resource?.()?.diffuse.url).toBe("diffuse.png")
    expect(resource?.()?.normal.url).toBe("normal.png")
  })
})
