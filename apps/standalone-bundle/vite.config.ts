import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  // The base comes from the build script (--base). Default: relative, works from any folder.
  base: './',
  plugins: [vue(), tailwindcss()],
  build: { emptyOutDir: true },
})
