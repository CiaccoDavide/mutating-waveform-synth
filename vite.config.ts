import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const host = process.env.TAURI_DEV_HOST
const isTauri = Boolean(
  process.env.TAURI_ENV_PLATFORM || process.env.TAURI_PLATFORM,
)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative for Tauri; repo-name base for GitHub Pages
  base: isTauri ? './' : '/mutating-waveform-synth/',
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  envPrefix: ['VITE_', 'TAURI_'],
})
