import { Component } from "solid-js";
import * as THREE from "three";
import { Vector3 } from "three";
import { Canvas, T, extend } from "../src";
import { Box } from "./Box";
import "./index.css";

extend(THREE);

export const App: Component = () => {
  // return "hallo";
  return (
    <Canvas camera={{ position: new Vector3(0, 0, 5) }}>
      <T.AmbientLight color={[0.2, 0.2, 0.2]} />
      <T.PointLight intensity={1.2} decay={1} position={[2, 2, 5]} rotation={[0, Math.PI / 3, 0]} />
      <Box />
      <T.ExtrudeGeometry args={[[new THREE.Shape()]]} />
    </Canvas>
  );
};
