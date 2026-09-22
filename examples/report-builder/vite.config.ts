import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative (not "/repo-name/") — it works on any GitHub Pages subpath (the
  // site is mounted at playground/report-builder/) without having to hardcode
  // the repo's name here. It is only safe because this app uses no
  // client-side router (a single-view SPA).
  base: './',
  plugins: [react(), tailwindcss()],
  // json-pdf-designer is a "file:" dependency linked (a symlink) to the
  // parent package — without this Vite may resolve "react" from ITS
  // node_modules instead of this app's, loading two copies of React (the
  // "Invalid hook call" error).
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
})
