import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

export default defineConfig({
  base: '/tracker/',
  plugins: [react()],
  server: {
    port: 3000,
    strictPort: true
  }
})