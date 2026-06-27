import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const base = env.VITE_BASE_PATH || '/';
  const unified = !!env.VITE_BASE_PATH;
  return {
    base,
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: unified ? 3001 : undefined,
      strictPort: unified,
      hmr: unified
        ? { clientPort: 3000, path: `${base.replace(/\/$/, '')}/` }
        : process.env.DISABLE_HMR !== 'true',
    },
  };
});
