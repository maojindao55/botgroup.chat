import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import pkg from './package.json'

export default defineConfig({
  plugins: [
    react()
  ],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.VITE_APP_VERSION || `v${pkg.version}`),
  },
  base: '/',
  server: {
    port: 3000,
    open: true,
    host: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    outDir: 'dist'
  }
})
