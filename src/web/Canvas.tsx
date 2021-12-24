import * as THREE from "three";
import { extend, createThreeRoot, RenderProps } from "../core";
import { createPointerEvents } from "./events";
import { RootState, ThreeContext } from "../core/store";
import { Accessor, createEffect, onCleanup, JSX, mergeProps } from "solid-js";
import { insert } from "../renderer";
import { Instance } from "../core/renderer";
import { StoreApi } from "zustand/vanilla";
import { EventManager } from "../core/events";

extend(THREE);

export interface Props
  extends Omit<RenderProps<HTMLCanvasElement>, "size" | "events"> {
  // ,
  //   HTMLAttributes<HTMLDivElement>
  children: JSX.Element;
  fallback?: JSX.Element;
  // resize?: ResizeOptions
  events?: (store: StoreApi<RootState>) => EventManager<any>;
  id?: string;
  class?: string;
  height?: string;
  width?: string;
  tabIndex?: number;
  // style?: CSSProperties;
}

// type SetBlock = false | Promise<null> | null;

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

export function Canvas(props: Props) {
  props = mergeProps(
    {
      height: "100vh",
      width: "100vw",
    },
    props
  );

  let canvas: HTMLCanvasElement;
  let containerRef: HTMLDivElement;

  createEffect(() => {
    if (!canvas || !containerRef) return;
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

    createEffect(() => {
      insert(
        root.getState().scene as unknown as Instance,
        (
          (
            <ThreeContext.Provider value={root}>
              {props.children}
            </ThreeContext.Provider>
          ) as unknown as Accessor<Instance[]>
        )()
      );

      onCleanup(() => {
        root.getState().scene.clear();
      });
    });

    onCleanup(() => {
      root.destroy();
    });
  });

  return (
    <div
      id={props.id}
      class={props.class}
      style={{
        height: props.height,
        width: props.width,
        position: "relative",
        overflow: "hidden",
      }}
      tabIndex={props.tabIndex}
      // @ts-expect-error
      ref={containerRef}
    >
      <canvas
        style={{ height: "100%", width: "100%" }}
        // @ts-expect-error
        ref={canvas}
      />
    </div>
  );
}
