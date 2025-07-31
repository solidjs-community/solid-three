// use default export for jest.spyOn
import { render } from "@solidjs/testing-library";

import { describe, expect, it } from "vitest";
import { T } from "../../src";
import { TestCanvas } from "../../src/testing";

describe("web Canvas", () => {
  it("should correctly mount", async () => {
    let renderer = render(() => (
      <TestCanvas>
        <T.Group />
      </TestCanvas>
    ));

    expect(renderer.container).toMatchSnapshot();
  });

  it("should forward ref", async () => {
    let ref: HTMLDivElement;

    render(() => (
      <TestCanvas ref={ref}>
        <T.Group />
      </TestCanvas>
    ));

    expect(ref!).toBeDefined();
  });

  it("should correctly unmount", async () => {
    let renderer = render(() => (
      <TestCanvas>
        <T.Group />
      </TestCanvas>
    ));

    expect(() => renderer.unmount()).not.toThrow();
  });

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
});
