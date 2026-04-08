import { fireEvent } from "../../libs/testing-library.ts"
import { Show, createSignal } from "solid-js"
import * as THREE from "three"
import { describe, expect, it, vi } from "vitest"
import { createT } from "../../src/index.ts"
import { settled, test } from "../../src/testing/index.tsx"

const T = createT(THREE)

describe("events", () => {
  it("can handle onPointerDown", async () => {
    const handlePointerDown = vi.fn()

    const { canvas, waitTillNextFrame } = await test(() => (
      <T.Mesh onMouseDown={handlePointerDown}>
        <T.BoxGeometry args={[2, 2]} />
        <T.MeshBasicMaterial />
      </T.Mesh>
    ))

    await settled()

    const evt = new Event("mousedown")
    Object.defineProperty(evt, "offsetX", { get: () => 640 })
    Object.defineProperty(evt, "offsetY", { get: () => 400 })

    fireEvent(canvas, evt)

    expect(handlePointerDown).toHaveBeenCalled()
  })

  // TODO:  implement onPointerMissed-api
  // NOTE:  unsure if/how we should implement onPointerMissed
  //        the heuristics are unclear imo

  // it("can handle onPointerMissed", async () => {
  //   const handleClick = vi.fn();
  //   const handleMissed = vi.fn();

  //   const { canvas } = await test(() => (
  //     <T.Mesh onPointerMissed={handleMissed} onClick={handleClick}>
  //       <T.BoxGeometry args={[2, 2]} />
  //       <T.MeshBasicMaterial />
  //     </T.Mesh>
  //   ));

  //   const evt = new MouseEvent("click");
  //   Object.defineProperty(evt, "offsetX", { get: () => 0 });
  //   Object.defineProperty(evt, "offsetY", { get: () => 0 });

  //   fireEvent(canvas, evt);

  //   expect(handleClick).not.toHaveBeenCalled();
  //   expect(handleMissed).toHaveBeenCalledWith(evt);
  // });

  // TODO:  implement onPointerMissed-api

  // it("should not fire onPointerMissed when same element is clicked", async () => {
  //   const handleClick = vi.fn();
  //   const handleMissed = vi.fn();

  //   const { canvas } = await test(() => (
  //     <T.Mesh onPointerMissed={handleMissed} onClick={handleClick}>
  //       <T.BoxGeometry args={[2, 2]} />
  //       <T.MeshBasicMaterial />
  //     </T.Mesh>
  //   ));

  //   const down = new Event("pointerdown");
  //   Object.defineProperty(down, "offsetX", { get: () => 577 });
  //   Object.defineProperty(down, "offsetY", { get: () => 480 });

  //   fireEvent(canvas, down);

  //   const up = new Event("pointerup");
  //   Object.defineProperty(up, "offsetX", { get: () => 577 });
  //   Object.defineProperty(up, "offsetY", { get: () => 480 });

  //   const evt = new MouseEvent("click");
  //   Object.defineProperty(evt, "offsetX", { get: () => 577 });
  //   Object.defineProperty(evt, "offsetY", { get: () => 480 });

  //   fireEvent(canvas, evt);

  //   expect(handleClick).toHaveBeenCalled();
  //   expect(handleMissed).not.toHaveBeenCalled();
  // });

  // TODO:  implement onPointerMissed-api

  // it("should not fire onPointerMissed on parent when child element is clicked", async () => {
  //   const handleClick = vi.fn();
  //   const handleMissed = vi.fn();

  //   const { canvas } = await test(() => (
  //     <T.Group onPointerMissed={handleMissed}>
  //       <T.Mesh onClick={handleClick}>
  //         <T.BoxGeometry args={[2, 2]} />
  //         <T.MeshBasicMaterial />
  //       </T.Mesh>
  //     </T.Group>
  //   ));

  //   const down = new Event("pointerdown");
  //   Object.defineProperty(down, "offsetX", { get: () => 577 });
  //   Object.defineProperty(down, "offsetY", { get: () => 480 });

  //   fireEvent(canvas, down);

  //   const up = new Event("pointerup");
  //   Object.defineProperty(up, "offsetX", { get: () => 577 });
  //   Object.defineProperty(up, "offsetY", { get: () => 480 });

  //   const evt = new MouseEvent("click");
  //   Object.defineProperty(evt, "offsetX", { get: () => 577 });
  //   Object.defineProperty(evt, "offsetY", { get: () => 480 });

  //   fireEvent(canvas, evt);

  //   expect(handleClick).toHaveBeenCalled();
  //   expect(handleMissed).not.toHaveBeenCalled();
  // });

  // TODO:  implement onPointerMissed-api

  // it("can handle onPointerMissed on Canvas", async () => {
  //   const handleMissed = vi.fn();

  //   const { canvas } = await test(() => (
  //     <T.Mesh>
  //       <T.BoxGeometry args={[2, 2]} />
  //       <T.MeshBasicMaterial />
  //     </T.Mesh>
  //   ));

  //   const evt = new MouseEvent("click");
  //   Object.defineProperty(evt, "offsetX", { get: () => 0 });
  //   Object.defineProperty(evt, "offsetY", { get: () => 0 });

  //   fireEvent(canvas, evt);
  //   expect(handleMissed).toHaveBeenCalledWith(evt);
  // });

  it("can handle onPointerMove", async () => {
    const handlePointerMove = vi.fn()
    const handlePointerEnter = vi.fn()
    const handlePointerOut = vi.fn()

    const { canvas } = await test(() => (
      <T.Mesh
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerOut}
        onPointerMove={handlePointerMove}
      >
        <T.BoxGeometry args={[2, 2]} />
        <T.MeshBasicMaterial />
      </T.Mesh>
    ))

    await settled()

    const evt1 = new Event("pointermove")
    Object.defineProperty(evt1, "offsetX", { get: () => 577 })
    Object.defineProperty(evt1, "offsetY", { get: () => 480 })

    fireEvent(canvas, evt1)

    expect(handlePointerMove).toHaveBeenCalled()
    expect(handlePointerEnter).toHaveBeenCalled()

    const evt2 = new Event("pointermove")
    Object.defineProperty(evt2, "offsetX", { get: () => 0 })
    Object.defineProperty(evt2, "offsetY", { get: () => 0 })

    fireEvent(canvas, evt2)

    expect(handlePointerOut).toHaveBeenCalled()
  })

  it("non-stoppable events (enter/leave) should not have stopPropagation", async () => {
    const handlePointerEnter = vi.fn().mockImplementation(e => {
      // Enter events are non-stoppable (like DOM pointerenter) — stopPropagation is not present
      expect(e.stopPropagation).toBeUndefined()
    })
    const handlePointerLeave = vi.fn()

    const { canvas } = await test(() => (
      <>
        <T.Mesh onPointerLeave={handlePointerLeave} onPointerEnter={handlePointerEnter}>
          <T.BoxGeometry args={[2, 2]} />
          <T.MeshBasicMaterial />
        </T.Mesh>
        <T.Mesh position-z={3}>
          <T.BoxGeometry args={[2, 2]} />
          <T.MeshBasicMaterial />
        </T.Mesh>
      </>
    ))

    await settled()

    const evt1 = new Event("pointermove")
    Object.defineProperty(evt1, "offsetX", { get: () => 577 })
    Object.defineProperty(evt1, "offsetY", { get: () => 480 })

    fireEvent(canvas, evt1)

    expect(handlePointerEnter).toHaveBeenCalled()

    const evt2 = new Event("pointermove")
    Object.defineProperty(evt2, "offsetX", { get: () => 0 })
    Object.defineProperty(evt2, "offsetY", { get: () => 0 })

    fireEvent(canvas, evt2)

    expect(handlePointerLeave).toHaveBeenCalled()
  })

  it("should handle stopPropagation on click events", async () => {
    const handleClickFront = vi.fn(e => e.stopPropagation())
    const handleClickRear = vi.fn()

    const { canvas } = await test(() => (
      <>
        <T.Mesh onClick={handleClickFront}>
          <T.BoxGeometry args={[2, 2]} />
          <T.MeshBasicMaterial />
        </T.Mesh>
        <T.Mesh onClick={handleClickRear} position-z={-3}>
          <T.BoxGeometry args={[2, 2]} />
          <T.MeshBasicMaterial />
        </T.Mesh>
      </>
    ))

    await settled()

    const down = new Event("pointerdown")
    Object.defineProperty(down, "offsetX", { get: () => 577 })
    Object.defineProperty(down, "offsetY", { get: () => 480 })

    fireEvent(canvas, down)

    const up = new Event("pointerup")
    Object.defineProperty(up, "offsetX", { get: () => 577 })
    Object.defineProperty(up, "offsetY", { get: () => 480 })

    fireEvent(canvas, up)

    const event = new Event("click")
    Object.defineProperty(event, "offsetX", { get: () => 577 })
    Object.defineProperty(event, "offsetY", { get: () => 480 })

    fireEvent(canvas, event)

    expect(handleClickFront).toHaveBeenCalled()
    expect(handleClickRear).not.toHaveBeenCalled()
  })

  // TODO:  implement pointer capture

  describe.skip("web pointer capture", () => {
    const handlePointerMove = vi.fn()
    const handlePointerDown = vi.fn(ev => {
      ;(ev.nativeEvent.target as any).setPointerCapture(ev.pointerId)
    })
    const handlePointerUp = vi.fn(ev =>
      (ev.nativeEvent.target as any).releasePointerCapture(ev.pointerId),
    )
    const handlePointerEnter = vi.fn()
    const handlePointerLeave = vi.fn()

    /* This component lets us unmount the event-handling object */
    function PointerCaptureTest(props: { hasMesh: boolean; manualRelease?: boolean }) {
      return (
        <Show when={props.hasMesh}>
          <T.Mesh
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={props.manualRelease ? handlePointerUp : undefined}
            onPointerLeave={handlePointerLeave}
            onPointerEnter={handlePointerEnter}
          >
            <T.BoxGeometry args={[2, 2]} />
            <T.MeshBasicMaterial />
          </T.Mesh>
        </Show>
      )
    }

    const pointerId = 1234

    it("should release when the capture target is unmounted", async () => {
      const [hasMesh, setHasMesh] = createSignal(true)

      // S3:   we do not have a replacement for rerender
      const { canvas } = await test(() => <PointerCaptureTest hasMesh={hasMesh()} />)

      await settled()

      canvas.setPointerCapture = vi.fn()
      canvas.releasePointerCapture = vi.fn()

      // @ts-expect-error TODO: fix type-error
      const down = new Event("pointerdown", { pointerId })
      Object.defineProperty(down, "offsetX", { get: () => 577 })
      Object.defineProperty(down, "offsetY", { get: () => 480 })

      /* testing-utils/react's fireEvent wraps the event like React does, so it doesn't match how our event handlers are called in production, so we call dispatchEvent directly. */
      canvas.dispatchEvent(down)

      /* This should have captured the DOM pointer */
      expect(handlePointerDown).toHaveBeenCalledTimes(1)
      expect(canvas.setPointerCapture).toHaveBeenCalledWith(pointerId)
      expect(canvas.releasePointerCapture).not.toHaveBeenCalled()

      /* Now remove the T.Mesh */
      setHasMesh(false)
      await settled()

      expect(canvas.releasePointerCapture).toHaveBeenCalledWith(pointerId)

      // @ts-expect-error TODO: fix type-error
      const move = new Event("pointerdown", { pointerId })
      Object.defineProperty(move, "offsetX", { get: () => 577 })
      Object.defineProperty(move, "offsetY", { get: () => 480 })

      canvas.dispatchEvent(move)

      /* There should now be no pointer capture */
      expect(handlePointerMove).not.toHaveBeenCalled()
    })

    it("should not leave when captured", async () => {
      const { canvas } = await test(() => <PointerCaptureTest hasMesh manualRelease />)

      await settled()

      canvas.setPointerCapture = vi.fn()
      canvas.releasePointerCapture = vi.fn()

      // @ts-expect-error TODO: fix type-error
      const moveIn = new Event("pointermove", { pointerId })
      Object.defineProperty(moveIn, "offsetX", { get: () => 577 })
      Object.defineProperty(moveIn, "offsetY", { get: () => 480 })

      // @ts-expect-error TODO: fix type-error
      const moveOut = new Event("pointermove", { pointerId })
      Object.defineProperty(moveOut, "offsetX", { get: () => -10000 })
      Object.defineProperty(moveOut, "offsetY", { get: () => -10000 })

      /* testing-utils/react's fireEvent wraps the event like React does, so it doesn't match how our event handlers are called in production, so we call dispatchEvent directly. */
      canvas.dispatchEvent(moveIn)
      expect(handlePointerEnter).toHaveBeenCalledTimes(1)
      expect(handlePointerMove).toHaveBeenCalledTimes(1)

      // @ts-expect-error TODO: fix type-error
      const down = new Event("pointerdown", { pointerId })
      Object.defineProperty(down, "offsetX", { get: () => 577 })
      Object.defineProperty(down, "offsetY", { get: () => 480 })

      canvas.dispatchEvent(down)

      // If we move the pointer now, when it is captured, it should raise the onPointerMove event even though the pointer is not over the element,
      // and NOT raise the onPointerLeave event.
      canvas.dispatchEvent(moveOut)
      expect(handlePointerMove).toHaveBeenCalledTimes(2)
      expect(handlePointerLeave).not.toHaveBeenCalled()

      canvas.dispatchEvent(moveIn)
      expect(handlePointerMove).toHaveBeenCalledTimes(3)

      // @ts-expect-error TODO: fix type-error
      const up = new Event("pointerup", { pointerId })
      Object.defineProperty(up, "offsetX", { get: () => 577 })
      Object.defineProperty(up, "offsetY", { get: () => 480 })
      // @ts-expect-error TODO: fix type-error
      const lostpointercapture = new Event("lostpointercapture", { pointerId })

      canvas.dispatchEvent(up)
      canvas.dispatchEvent(lostpointercapture)

      // The pointer is still over the element, so onPointerLeave should not have been called.
      expect(handlePointerLeave).not.toHaveBeenCalled()

      // The element pointer should no longer be captured, so moving it away should call onPointerLeave.
      canvas.dispatchEvent(moveOut)
      expect(handlePointerEnter).toHaveBeenCalledTimes(1)
      expect(handlePointerLeave).toHaveBeenCalledTimes(1)
    })
  })
})
