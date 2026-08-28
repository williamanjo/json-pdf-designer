import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // Relativo (não "/repo-name/") — funciona em qualquer subpath do GitHub
  // Pages (site é montado em playground/report-builder/) sem precisar
  // hardcodar o nome do repo aqui. Só é seguro porque este app não usa
  // client-side router (SPA de view única).
  base: './',
  plugins: [react(), tailwindcss()],
  // json-pdf-designer é uma dependência "file:" linkada (symlink) pro
  // pacote pai — sem isso o Vite pode resolver "react" a partir do
  // node_modules dele em vez do node_modules deste app, carregando duas
  // cópias de React (erro "Invalid hook call").
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
})
