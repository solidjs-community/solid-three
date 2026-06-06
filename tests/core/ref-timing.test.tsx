import { createRenderEffect } from "solid-js"
import * as THREE from "three"
import { describe, expect, it } from "vitest"
import { createT } from "../../src/index.ts"
import { test } from "../../src/testing/index.tsx"

const T = createT(THREE)

describe("ref timing", () => {
  // Matches Solid DOM: a parent's ref must be assigned BEFORE its children mount,
  // so a child can read the parent ref in a reactive binding during its own render.
  it("a child sees the parent's ref during its own render", () => {
    let parent: THREE.Mesh | undefined
    let seenByChild: THREE.Object3D | undefined

    const Child = (props: { parent: () => THREE.Mesh | undefined }) => {
      // Runs during the child's creation, like a reactive prop binding would.
      createRenderEffect(() => (seenByChild = props.parent()))
      return <T.MeshBasicMaterial />
    }

    test(() => (
      <T.Mesh ref={parent}>
        <T.BoxGeometry args={[2, 2]} />
        <Child parent={() => parent} />
      </T.Mesh>
    ))

    expect({ parentAssigned: parent != null, childSawParent: seenByChild === parent }).toEqual({
      parentAssigned: true,
      childSawParent: true,
    })
  })
})
