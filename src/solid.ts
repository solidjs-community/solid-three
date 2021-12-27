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
      `%c${renderer} %s  %c`,
      "font-weight: bold",
      action,
      "font-weight: normal",
      ...options
    );
}

function checkCatalogue(element: string) {
  return catalogue[toFirstUpper(element)] !== undefined || element === "primitive";
}

export function createSolidRenderer({
  createInstance,
  applyProp,
  appendChild,
  insertBefore,
  removeChild,
  attach
}: ThreeRenderer) {
  return createRenderer<Instance>({
    // @ts-ignore
    createElement(element: string, args) {
      log("three", "createElement", element);
      if (element === "scene") {
        return prepare<Instance>(new Scene() as unknown as Instance);
      }
      let root = useContext(ThreeContext);
      return createInstance(
        element,
        {
          args
        },
        root
      );
    },
    createTextNode(value: string) {
      return prepare({
        text: value,
        type: "text"
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
        attach(node.__r3f.parent, node, value);
      }
    },
    insertNode(parent, node, anchor) {
      log("three", "insertNode", parent, node, anchor);
      if (node instanceof Text) {
        return;
      }

      if (anchor) {
        insertBefore(parent, node, anchor);
      } else {
        appendChild(parent, node);
      }
    },
    isTextNode(node) {
      return node.type === "text";
    },
    removeNode(parent, node) {
      log("three", "removeNode", parent, node);
      removeChild(parent, node, true);
    },

    getParentNode(node) {
      log("three", "getParentNode", node);
      return node.__r3f.parent as unknown as Instance;
    },
    getFirstChild(node) {
      log("three", "getFirstChild", node);
      return node.__r3f.objects?.length ? node.__r3f.objects[0] : node.children[0];
    },
    getNextSibling(node) {
      log("three", "getNextSibling", node);
      return node.nextSibling;
    }
  });
}
