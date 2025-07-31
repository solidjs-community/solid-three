import { Accessor } from "solid-js";

export function resolve<T>(child: Accessor<T> | T, recursive = false): T {
  return typeof child !== "function"
    ? child
    : recursive
    ? resolve((child as Accessor<T>)())
    : (child as Accessor<T>)();
}
