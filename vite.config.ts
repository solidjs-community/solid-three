import path from 'path'
import devtools from 'solid-devtools/vite'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import inspect from 'vite-plugin-inspect'
import solidPlugin from 'vite-plugin-solid'

export default defineConfig(async (mode) => ({
  resolve: {
    alias: {
      '@src': path.resolve(__dirname, './src'),
    },
  },
  build:
    process.env.BUILD_MODE === 'lib'
      ? {
          lib: {
            entry: './src/index.tsx',
            formats: ['es', 'cjs', 'umd'],
            fileName: 'index',
            name: 'SolidThree',
          },
          minify: false,
          rollupOptions: {
            external: ['solid-js', 'solid-js/web', 'solid-js/store', 'three', 'zustand', 'zustand/vanilla'],
          },
          polyfillDynamicImport: false,
        }
      : {},
  plugins: [
    devtools(),
    dts({
      insertTypesEntry: true,
    }),
    solidPlugin(),
    inspect(),
  ],
}))
