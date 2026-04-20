import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Configuración de Vite para compilar el proyecto React
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000
  }
})