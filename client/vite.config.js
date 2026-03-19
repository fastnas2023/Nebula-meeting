import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendPort = env.VITE_SERVER_PORT || env.VITE_SIGNALING_PORT || '5002';
  const backendTarget = `http://localhost:${backendPort}`;
  const useHttps = env.VITE_DEV_HTTPS === 'true' || env.VITE_HTTPS === 'true';

  return {
    plugins: [react(), tailwindcss(), ...(useHttps ? [basicSsl()] : [])],
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx,js,jsx}'],
      exclude: ['tests/**', 'node_modules/**'],
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      https: useHttps,
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
        '/socket.io': {
          target: backendTarget,
          ws: true,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
})
