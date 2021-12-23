import * as THREE from "three";
import { extend, createThreeRoot } from "../core";
import { createPointerEvents } from "./events";
import { ThreeContext } from "../core/store";
import { Accessor, createEffect, onCleanup } from "solid-js";
import { Scene } from "three";
import { insert, insertNode } from "../renderer";
import { prepare } from "../core/utils";
import { Instance } from "../core/renderer";

extend(THREE);

// const CANVAS_PROPS: Array<keyof Props> = [
//   "gl",
//   "events",
//   "shadows",
//   "linear",
//   "flat",
//   "orthographic",
//   "frameloop",
//   "dpr",
//   "performance",
//   "clock",
//   "raycaster",
//   "camera",
//   "onPointerMissed",
//   "onCreated",
// ];

export function Canvas(props) {
  let canvas: HTMLCanvasElement;
  let containerRef: HTMLDivElement;

  createEffect(() => {
    const root = createThreeRoot(canvas, {
      events: createPointerEvents,
      size: containerRef.getBoundingClientRect(),
      camera: props.camera,
      shadows: props.shadows,
    });

    new ResizeObserver((entries) => {
      if (entries[0]?.target !== containerRef) return;
      root
        .getState()
        .setSize(entries[0].contentRect.width, entries[0].contentRect.height);
    }).observe(containerRef);

    let scene = prepare(new Scene());
    root.setState({ scene });

    insert(
      scene as unknown as Instance,
      (
        (
          <ThreeContext.Provider value={root}>
            {props.children}
          </ThreeContext.Provider>
        ) as unknown as Accessor<Instance[]>
      )()
    );

    onCleanup(() => {
      root.destroy();
    });
  });

  return (
    <div
      id={props.id}
      className={props.className}
      style={{
        height: "100%",
        width: "100%",
        position: "relative",
        overflow: "hidden",
      }}
      tabIndex={props.tabIndex}
      ref={containerRef}
    >
      <canvas style={{ height: "100%", width: "100%" }} ref={canvas} />
    </div>
  );
}
