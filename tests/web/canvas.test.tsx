import { render } from "../../libs/testing-library.ts"
import * as THREE from "three"
import { describe, expect, it } from "vitest"
import { createT } from "../../src/index.ts"
import { TestCanvas } from "../../src/testing/index.tsx"
import type { Context } from "../../src/types.ts"

const T = createT(THREE)

describe("web Canvas", () => {
  it("should correctly mount", async () => {
    let renderer = render(() => (
      <TestCanvas>
        <T.Group />
      </TestCanvas>
    ))

    expect(renderer.container).toMatchSnapshot()
  })

  it("should forward ref", async () => {
    let ref: Context

    render(() => (
      <TestCanvas ref={ref!}>
        <T.Group />
      </TestCanvas>
    ))

    expect(ref!).toBeDefined()
  })

  it("should correctly unmount", async () => {
    let renderer = render(() => (
      <TestCanvas>
        <T.Group />
      </TestCanvas>
    ))

    expect(() => renderer.unmount()).not.toThrow()
  })

  // it("plays nice with react SSR", async () => {
  //   const useLayoutEffect = jest.spyOn(React, "useLayoutEffect");

  //   await act(async () => {
  //     render(
  //       <Canvas>
  //         <T.Group />
  //       </Canvas>,
  //     );
  //   });

  //   expect(useLayoutEffect).not.toHaveBeenCalled();
  // });
})
