// vite.config.ts
import path from "path";
import { defineConfig } from "file:///Users/bigmistqke/Documents/GitHub/solid-three/node_modules/.pnpm/vite@4.1.1_@types+node@18.16.19/node_modules/vite/dist/node/index.js";
import dts from "file:///Users/bigmistqke/Documents/GitHub/solid-three/node_modules/.pnpm/vite-plugin-dts@3.3.1_nqy77nvhwlrabhw23urdbzoxly/node_modules/vite-plugin-dts/dist/index.mjs";
import inspect from "file:///Users/bigmistqke/Documents/GitHub/solid-three/node_modules/.pnpm/vite-plugin-inspect@0.7.14_vite@4.1.1/node_modules/vite-plugin-inspect/dist/index.mjs";
import solidPlugin from "file:///Users/bigmistqke/Documents/GitHub/solid-three/node_modules/.pnpm/vite-plugin-solid@2.5.0_solid-js@1.7.8+vite@4.1.1/node_modules/vite-plugin-solid/dist/esm/index.mjs";
var __vite_injected_original_dirname = "/Users/bigmistqke/Documents/GitHub/solid-three/packages/fiber";
var vite_config_default = defineConfig(async (mode) => ({
  resolve: {
    alias: {
      "@solid-three/fiber": path.resolve(__vite_injected_original_dirname, "./src")
    }
  },
  build: {
    lib: {
      entry: "./src/index.tsx",
      formats: ["es", "cjs", "umd"],
      fileName: "index",
      name: "SolidThree"
    },
    minify: false,
    rollupOptions: {
      external: ["solid-js", "solid-js/web", "solid-js/store", "three", "zustand", "zustand/vanilla"]
    },
    polyfillDynamicImport: false
  },
  plugins: [
    dts({
      insertTypesEntry: true
    }),
    solidPlugin(),
    inspect()
  ]
}));
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvYmlnbWlzdHFrZS9Eb2N1bWVudHMvR2l0SHViL3NvbGlkLXRocmVlL3BhY2thZ2VzL2ZpYmVyXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvVXNlcnMvYmlnbWlzdHFrZS9Eb2N1bWVudHMvR2l0SHViL3NvbGlkLXRocmVlL3BhY2thZ2VzL2ZpYmVyL3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9Vc2Vycy9iaWdtaXN0cWtlL0RvY3VtZW50cy9HaXRIdWIvc29saWQtdGhyZWUvcGFja2FnZXMvZmliZXIvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgcGF0aCBmcm9tICdwYXRoJ1xyXG5pbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJ1xyXG5pbXBvcnQgZHRzIGZyb20gJ3ZpdGUtcGx1Z2luLWR0cydcclxuaW1wb3J0IGluc3BlY3QgZnJvbSAndml0ZS1wbHVnaW4taW5zcGVjdCdcclxuaW1wb3J0IHNvbGlkUGx1Z2luIGZyb20gJ3ZpdGUtcGx1Z2luLXNvbGlkJ1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKGFzeW5jIChtb2RlKSA9PiAoe1xyXG4gIHJlc29sdmU6IHtcclxuICAgIGFsaWFzOiB7XHJcbiAgICAgICdAc29saWQtdGhyZWUvZmliZXInOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLi9zcmMnKSxcclxuICAgIH0sXHJcbiAgfSxcclxuICBidWlsZDoge1xyXG4gICAgbGliOiB7XHJcbiAgICAgIGVudHJ5OiAnLi9zcmMvaW5kZXgudHN4JyxcclxuICAgICAgZm9ybWF0czogWydlcycsICdjanMnLCAndW1kJ10sXHJcbiAgICAgIGZpbGVOYW1lOiAnaW5kZXgnLFxyXG4gICAgICBuYW1lOiAnU29saWRUaHJlZScsXHJcbiAgICB9LFxyXG4gICAgbWluaWZ5OiBmYWxzZSxcclxuICAgIHJvbGx1cE9wdGlvbnM6IHtcclxuICAgICAgZXh0ZXJuYWw6IFsnc29saWQtanMnLCAnc29saWQtanMvd2ViJywgJ3NvbGlkLWpzL3N0b3JlJywgJ3RocmVlJywgJ3p1c3RhbmQnLCAnenVzdGFuZC92YW5pbGxhJ10sXHJcbiAgICB9LFxyXG4gICAgcG9seWZpbGxEeW5hbWljSW1wb3J0OiBmYWxzZSxcclxuICB9LFxyXG4gIHBsdWdpbnM6IFtcclxuICAgIGR0cyh7XHJcbiAgICAgIGluc2VydFR5cGVzRW50cnk6IHRydWUsXHJcbiAgICB9KSxcclxuICAgIHNvbGlkUGx1Z2luKCksXHJcbiAgICBpbnNwZWN0KCksXHJcbiAgXSxcclxufSkpXHJcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBeVcsT0FBTyxVQUFVO0FBQzFYLFNBQVMsb0JBQW9CO0FBQzdCLE9BQU8sU0FBUztBQUNoQixPQUFPLGFBQWE7QUFDcEIsT0FBTyxpQkFBaUI7QUFKeEIsSUFBTSxtQ0FBbUM7QUFNekMsSUFBTyxzQkFBUSxhQUFhLE9BQU8sVUFBVTtBQUFBLEVBQzNDLFNBQVM7QUFBQSxJQUNQLE9BQU87QUFBQSxNQUNMLHNCQUFzQixLQUFLLFFBQVEsa0NBQVcsT0FBTztBQUFBLElBQ3ZEO0FBQUEsRUFDRjtBQUFBLEVBQ0EsT0FBTztBQUFBLElBQ0wsS0FBSztBQUFBLE1BQ0gsT0FBTztBQUFBLE1BQ1AsU0FBUyxDQUFDLE1BQU0sT0FBTyxLQUFLO0FBQUEsTUFDNUIsVUFBVTtBQUFBLE1BQ1YsTUFBTTtBQUFBLElBQ1I7QUFBQSxJQUNBLFFBQVE7QUFBQSxJQUNSLGVBQWU7QUFBQSxNQUNiLFVBQVUsQ0FBQyxZQUFZLGdCQUFnQixrQkFBa0IsU0FBUyxXQUFXLGlCQUFpQjtBQUFBLElBQ2hHO0FBQUEsSUFDQSx1QkFBdUI7QUFBQSxFQUN6QjtBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsSUFBSTtBQUFBLE1BQ0Ysa0JBQWtCO0FBQUEsSUFDcEIsQ0FBQztBQUFBLElBQ0QsWUFBWTtBQUFBLElBQ1osUUFBUTtBQUFBLEVBQ1Y7QUFDRixFQUFFOyIsCiAgIm5hbWVzIjogW10KfQo=
