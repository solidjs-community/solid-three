import { T, Canvas } from "../src";
import { Box } from "./Box";

export function App() {
  return (
    <Canvas
      camera={{
        position: [3, 3, 3]
      }}
      gl={{
        antialias: true
      }}
      shadows
    >
      <Box />
      <T.AmbientLight />
      <T.SpotLight position={[0, 5, 10]} intensity={1} />
    </Canvas>
  );
}
