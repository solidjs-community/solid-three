import path from 'path'
import devtools from 'solid-devtools/vite'
import { defineConfig } from 'vite'
import solidPlugin from 'vite-plugin-solid'

export default defineConfig(async (mode) => ({
  resolve: {
    alias: {},
  },
  plugins: [devtools(), solidPlugin()],
}))
