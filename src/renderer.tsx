import {
  Accessor,
  Component,
  createMemo,
  JSX,
  splitProps,
  untrack,
} from "solid-js";
import { createRenderer } from "./core/renderer";
import { createThreeRoot, roots } from "./core";
import { Instance } from "./core/renderer";
import { createSolidRenderer, log } from "./solid";

export const threeRenderer = createSolidRenderer(createRenderer(roots));

const PROPERTIES = new Set(["className", "class", "textContent"]);

const domRenderer = {
  createElement(el: string) {
    log("dom", "createElement", el);
    return document.createElement(el);
  },
  owns: function (node: any): node is HTMLElement {
    return node instanceof HTMLElement || node instanceof Text;
  },
  createTextNode(value) {
    log("dom", "createTextNode", value);
    return document.createTextNode(value);
  },
  replaceText(textNode: Text, value) {
    log("dom", "replaceText", textNode, value);
    textNode.data = value;
  },
  setProperty(node: HTMLElement, name: string, value: any) {
    log("dom", "setProperty", node, name, node[name], value);
    if (name === "style") {
      Object.assign(node.style, value);
      return;
    } else if (name === "class") node.className = value;
    else if (name.startsWith("on")) node[name.toLowerCase()] = value;
    else if (PROPERTIES.has(name)) node[name] = value;
    else {
      node.setAttribute(name, value);
    }
  },
  insertNode(
    parent: HTMLElement,
    node: HTMLElement | Text,
    anchor?: HTMLElement | Text
  ) {
    log("dom", "insertNode", parent, node, anchor);
    if (
      parent instanceof HTMLElement &&
      (node instanceof HTMLElement || node instanceof Text)
    ) {
      parent.insertBefore(node, anchor);
    }
  },
  isTextNode(node) {
    log("dom", "isTextNode", node);
    return node.type === 3;
  },
  removeNode(parent, node) {
    log("dom", "removeNode", parent, node);
    if (parent instanceof HTMLElement) {
      parent.removeChild(node);
    } else {
      parent.remove(node);
    }
  },
  getParentNode(node) {
    return node.parentNode;
  },
  getFirstChild(node) {
    return node.firstChild;
  },
  getNextSibling(node) {
    return node.nextSibling;
  },
};

export const {
  render,
  effect,
  memo,
  createComponent,
  createElement,
  createTextNode,
  insertNode,
  insert,
  spread,
  setProp,
  mergeProps,
} = createRenderer<HTMLElement | Instance | Text>({
  createElement(string) {
    if (threeRenderer.knowsElement(string) && string !== "path") {
      return threeRenderer.createElement(string);
    } else {
      return domRenderer.createElement(string);
    }
  },
  createTextNode(value) {
    return domRenderer.createTextNode(value);
  },
  replaceText(textNode: Text, value: string) {
    return domRenderer.replaceText(textNode, value);
  },
  setProperty(node, name, value) {
    if (domRenderer.owns(node)) {
      return domRenderer.setProperty(node, name, value);
    }

    return threeRenderer.setProperty(node, name, value);
  },
  insertNode(parent, node, anchor) {
    if (domRenderer.owns(parent) && domRenderer.owns(node)) {
      return domRenderer.insertNode(parent, node, anchor as HTMLElement | Text);
    } else if (
      domRenderer.owns(parent) &&
      parent instanceof HTMLCanvasElement
    ) {
      let root = createThreeRoot(parent, {});
      root.setState({ scene: node as unknown as THREE.Scene });
      // createRenderEffect(() => {
      // });
    }

    return threeRenderer.insertNode(parent, node, anchor);
  },
  isTextNode(node) {
    if (domRenderer.owns(node)) {
      return domRenderer.isTextNode(node);
    }
  },
  removeNode(parent, node) {
    if (domRenderer.owns(parent)) {
      return domRenderer.removeNode(parent, node);
    }
    return threeRenderer.removeNode(parent, node);
  },
  getParentNode(node) {
    if (domRenderer.owns(node)) {
      return domRenderer.getParentNode(node);
    }
    return threeRenderer.getParentNode(node);
  },
  getFirstChild(node) {
    if (domRenderer.owns(node)) {
      return domRenderer.getFirstChild(node);
    }
    return threeRenderer.getFirstChild(node);
  },
  getNextSibling(node) {
    return domRenderer.getNextSibling(node);
  },
});

export * from "solid-js";

type DynamicProps<T> = T & {
  children?: any;
  component?: Component<T> | string | keyof JSX.IntrinsicElements;
};

/**
 * renders an arbitrary custom or native component and passes the other props
 * ```typescript
 * <Dynamic component={multiline() ? 'textarea' : 'input'} value={value()} />
 * ```
 * @description https://www.solidjs.com/docs/latest/api#%3Cdynamic%3E
 */
export function Dynamic<T>(props: DynamicProps<T>): Accessor<JSX.Element> {
  const [p, others] = splitProps(props, ["component"]);
  return createMemo(() => {
    const component = p.component as Function | string;
    switch (typeof component) {
      case "function":
        return untrack(() => component(others));

      case "string":
        // const isSvg = SVGElements.has(component);
        // const el = sharedConfig.context
        //   ? getNextElement()
        let el = createElement(component);

        spread(el, others, true);
        return el;

      default:
        break;
    }
  });
}
