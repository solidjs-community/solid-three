import { createEffect, createMemo, createSignal, mergeProps, onCleanup } from "solid-js";
import { whenever } from "./conditionals.ts";
import { debounce as createDebounce } from "./debounce.ts";

declare type ResizeObserverCallback = (entries: any[], observer: ResizeObserver) => void;
declare class ResizeObserver {
  constructor(callback: ResizeObserverCallback);
  observe(target: Element, options?: any): void;
  unobserve(target: Element): void;
  disconnect(): void;
  static toString(): string;
}

export interface Measure {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

type HTMLOrSVGElement = HTMLElement | SVGElement;

export type UseMeasureOptions = {
  debounce?: number | { scroll: number; resize: number };
  scroll?: boolean;
  polyfill?: { new (cb: ResizeObserverCallback): ResizeObserver };
  offsetSize?: boolean;
};

export function useMeasure(options?: UseMeasureOptions) {
  const config = mergeProps(
    {
      debounce: 0,
      scroll: false,
      offsetSize: false,
    },
    options,
  );

  const ResizeObserver =
    config.polyfill ||
    (typeof window === "undefined" ? class ResizeObserver {} : (window as any).ResizeObserver);

  if (!ResizeObserver) {
    throw new Error(
      "This browser does not support ResizeObserver out of the box. See: https://github.com/react-spring/react-use-measure/#resize-observer-polyfills",
    );
  }

  const [element, setElement] = createSignal<HTMLOrSVGElement | null>(null);
  const [bounds, setBounds] = createSignal<Measure>({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    bottom: 0,
    right: 0,
    x: 0,
    y: 0,
  });
  const scrollContainers = createMemo(() => findScrollContainers(element()));
  let lastBounds: Measure;

  const getDebounce = (type: "scroll" | "resize") => {
    const debounce = config.debounce
      ? typeof config.debounce === "number"
        ? config.debounce
        : config.debounce[type]
      : null;
    if (debounce) return createDebounce(forceRefresh, debounce);
    return forceRefresh;
  };

  const forceRefresh = whenever(element, element => {
    const { left, top, width, height, bottom, right, x, y } =
      element.getBoundingClientRect() as unknown as Measure;

    const bounds = {
      left,
      top,
      width,
      height,
      bottom,
      right,
      x,
      y,
    };

    if (element instanceof HTMLElement && config.offsetSize) {
      bounds.height = element.offsetHeight;
      bounds.width = element.offsetWidth;
    }

    Object.freeze(bounds);

    if (!lastBounds || !areBoundsEqual(lastBounds, bounds)) {
      lastBounds = bounds;
      setBounds(bounds);
    }
  });

  createEffect(() => {
    const onScroll = getDebounce("scroll");

    createEffect(() => {
      if (!config.scroll) return;
      globalThis.addEventListener("scroll", onScroll, { capture: true, passive: true });
      onCleanup(() => globalThis.removeEventListener("scroll", onScroll, true));
    });

    createEffect(
      whenever(scrollContainers, scrollContainers => {
        if (!config.scroll || !scrollContainers) return;
        scrollContainers.forEach(scrollContainer =>
          scrollContainer.addEventListener("scroll", onScroll, {
            capture: true,
            passive: true,
          }),
        );

        onCleanup(() => {
          scrollContainers.forEach(element => {
            element.removeEventListener("scroll", onScroll, true);
          });
        });
      }),
    );
  });

  createEffect(() => {
    const onResize = getDebounce("resize");

    globalThis.addEventListener("resize", onResize);
    onCleanup(() => globalThis.removeEventListener("resize", onResize));

    createEffect(
      whenever(element, element => {
        const observer = new ResizeObserver(onResize);
        observer.observe(element);
        onCleanup(() => observer.disconnect());
      }),
    );
  });

  return {
    setElement: (source: HTMLOrSVGElement | null) => {
      if (!source || source === element()) return;
      setElement(source);
    },
    bounds,
    forceRefresh,
  };
}

// Returns a list of scroll offsets
function findScrollContainers(element: HTMLOrSVGElement | null): HTMLOrSVGElement[] {
  const result: HTMLOrSVGElement[] = [];
  if (!element || element === document.body) return result;
  const { overflow, overflowX, overflowY } = globalThis.getComputedStyle(element);
  if ([overflow, overflowX, overflowY].some(prop => prop === "auto" || prop === "scroll"))
    result.push(element);
  return [...result, ...findScrollContainers(element.parentElement)];
}

// Checks if element boundaries are equal
const keys: (keyof Measure)[] = ["x", "y", "top", "bottom", "left", "right", "width", "height"];
const areBoundsEqual = (a: Measure, b: Measure): boolean => keys.every(key => a[key] === b[key]);
