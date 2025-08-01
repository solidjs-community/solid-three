import * as THREE from "three";
import { extend } from "../src";
import { ResizeObserver } from "@juggle/resize-observer";

globalThis.ResizeObserver = ResizeObserver;

// Extend catalogue for render API in tests
extend(THREE);
