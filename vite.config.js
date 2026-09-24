import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Standalone Nonet app. Same toolchain as the portfolio ecosystem
// (React 19 + Vite 8 + Tailwind v4) so any piece is easy to move between them.
export default defineConfig({
  // Served from /nonet/ when embedded in the portfolio (humaidi.me/nonet).
  // BASE_URL flows through to the router basename in main.jsx, so the app
  // works both standalone and mounted under this subpath with no other change.
  base: '/nonet/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
