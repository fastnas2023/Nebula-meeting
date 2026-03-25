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
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;

            if (id.includes('agora-rtc-sdk-ng/esm/AgoraRTC_N-production.esm-bundler.mjs')) return 'agora-sdk';
            if (id.includes('/@agora-js/media/')) return 'agora-media';
            if (id.includes('/@agora-js/shared/')) return 'agora-shared';
            if (id.includes('/@agora-js/report/')) return 'agora-report';
            if (id.includes('/webrtc-adapter/')) return 'agora-webrtc-adapter';
            if (id.includes('/axios/')) return 'agora-http';
            if (id.includes('/formdata-polyfill/')) return 'agora-formdata';

            if (id.includes('/three/')) return 'three-core';
            if (id.includes('/@react-three/fiber/')) return 'react-three-fiber';
            if (id.includes('/@react-three/drei/')) return 'react-three-drei';
            if (id.includes('/maath/')) return 'maath-vendor';

            if (id.includes('react-i18next') || id.includes('/i18next')) {
              return 'i18n-vendor';
            }

            if (id.includes('lucide-react')) {
              return 'icons-vendor';
            }

            if (
              id.includes('/react/')
              || id.includes('/react-dom/')
              || id.includes('scheduler')
            ) {
              return 'react-vendor';
            }
          },
        },
      },
    },
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
