
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // `loadEnv` might still be useful if other VITE_ prefixed variables are used by the frontend.
  // The `define` for API_KEY is removed as the frontend no longer uses it directly.
  // FIX: Cast process to any to resolve TypeScript error for 'cwd' property.
  void loadEnv(mode, (process as any).cwd(), ''); // Call loadEnv, but do not assign to an unused variable

  return {
    plugins: [react()],
    // The `define` property for 'process.env.API_KEY' is removed.
    // The frontend will now call a backend proxy which handles the API key securely.
  }
})