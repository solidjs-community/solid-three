import { prepare, toFirstUpper } from "./core/utils";
import { ThreeContext } from "./core/store";
import { useContext } from "solid-js";
import { Scene } from "three";
import { ThreeRenderer, catalogue, Instance } from "./core/renderer";
import { createRenderer } from "solid-js/universal";

export let DEBUG = window.location.search.indexOf("debug") > -1;

export function log(renderer: string, action: any, ...options: any[]) {
  DEBUG &&
    console.debug(
      `%c[${renderer}] %s  %c`,
      "font-weight: bold",
      action,
      "font-weight: normal",
      ...options
    );
}

function checkCatalogue(element: string) {
  return (
    catalogue[toFirstUpper(element)] !== undefined || element === "primitive"
  );
}

export function createSolidRenderer({
  createInstance,
  applyProp,
  appendChild,
}: ThreeRenderer) {
  return createRenderer<Instance>({
    // @ts-ignore

    createElement(element: string) {
      log("three", "createElement", element);
      if (element === "scene") {
        return prepare<Instance>(new Scene() as unknown as Instance);
      }
      let root = useContext(ThreeContext);
      return createInstance(element, {}, root);
    },
    createTextNode(value: string) {
      return prepare({
        text: value,
        type: "text",
      }) as any;
    },
    replaceText(textNode: Instance, value: string) {
      throw new Error("Cant replace text node in three");
    },
    setProperty(node: Instance, key: string, value: any) {
      log("three", "setProperty", node, key, node[key], value);
      if (/^on(Pointer|Click|DoubleClick|ContextMenu|Wheel)/.test(key))
        return applyProp(node, [key, value, true, []]);
      // Split dashed props
      let entries: string[] = [];
      if (key.includes("-")) entries = key.split("-");
      applyProp(node, [key, value, false, entries]);

      if (key === "attach" && node.__r3f.parent) {
        node.__r3f.parent[value] = node;
      }
    },
    insertNode(parent, node, anchor) {
      log("three", "insertNode", parent, node, anchor);
      if (node instanceof Text) {
        return;
      }

      appendChild(parent, node);

      if (node.__r3f.attach && node.__r3f.parent) {
        if (typeof node.__r3f.attach === "string") {
          node.__r3f.parent[node.__r3f.attach] = node;
        }
      }
    },
    isTextNode(node) {
      return false;
    },
    removeNode(parent, node) {
      parent.remove(node);
    },
    getParentNode(node) {
      return node.parent as unknown as Instance;
    },
    getFirstChild(node) {
      return node.children[0];
    },
    getNextSibling(node) {
      return node.nextSibling;
    },
  });
}
