import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

declare const process: any;

// https://vitejs.dev/config/
export default defineConfig(() => {
  // Environment variables set directly on Render are available via `process.env`.
  const defaultAppUrl = 'https://www.getdesign.cloud'; // Fallback URL

  return {
    plugins: [react()],
    define: {
      // Expose PUBLIC_APP_URL to the frontend from the environment
      'process.env.PUBLIC_APP_URL': JSON.stringify(process.env.PUBLIC_APP_URL || defaultAppUrl),
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          secure: false,
        }
      }
    }
  }
})