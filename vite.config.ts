import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: 'jimy.novrein.com',
    port: 5173,
    allowedHosts: ['jimy.novrein.com']
  }
})