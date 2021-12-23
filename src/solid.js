import { prepare, toFirstUpper } from "./core/utils";
import { ThreeContext } from "./core/store";
import { useContext } from "solid-js";
import { Scene } from "three";
import { catalogue } from "./core/renderer";
import { createRenderer } from "solid-js/universal";
export let DEBUG = window.location.search.indexOf("debug") > -1;
export function log(renderer, action, ...options) {
    DEBUG &&
        console.debug(`%c[${renderer}] %s  %c`, "font-weight: bold", action, "font-weight: normal", ...options);
}
function checkCatalogue(element) {
    return (catalogue[toFirstUpper(element)] !== undefined || element === "primitive");
}
export function createSolidRenderer({ createInstance, applyProp, appendChild, }) {
    return createRenderer({
        // @ts-ignore
        createElement(element) {
            log("three", "createElement", element);
            if (element === "scene") {
                return prepare(new Scene());
            }
            let root = useContext(ThreeContext);
            return createInstance(element, {}, root);
        },
        createTextNode(value) {
            throw new Error("Cant create text node in three");
        },
        replaceText(textNode, value) {
            throw new Error("Cant replace text node in three");
        },
        setProperty(node, key, value) {
            log("three", "setProperty", node, key, node[key], value);
            if (/^on(Pointer|Click|DoubleClick|ContextMenu|Wheel)/.test(key))
                return applyProp(node, [key, value, true, []]);
            // Split dashed props
            let entries = [];
            if (key.includes("-"))
                entries = key.split("-");
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
            return node.parent;
        },
        getFirstChild(node) {
            return node.children[0];
        },
        getNextSibling(node) {
            return node.nextSibling;
        },
    });
}
