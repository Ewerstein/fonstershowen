import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { createReadStream, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * MediaPipe läser sina WebAssembly-filer vid körning. De kopieras från paketet till /mediapipe/,
 * så att appen inte hämtar kod från ett CDN och versionen alltid stämmer med paketet.
 */
function mediapipeWasm(): Plugin {
  const dir = resolve(import.meta.dirname, 'node_modules/@mediapipe/tasks-vision/wasm');
  const files = [
    'vision_wasm_internal.js',
    'vision_wasm_internal.wasm',
    'vision_wasm_nosimd_internal.js',
    'vision_wasm_nosimd_internal.wasm',
  ];
  const type = (file: string) => (file.endsWith('.wasm') ? 'application/wasm' : 'text/javascript');
  return {
    name: 'fonstershowen-mediapipe-wasm',
    configureServer(server) {
      server.middlewares.use('/mediapipe/', (req, res, next) => {
        const file = (req.url ?? '').replace(/^\//, '').split('?')[0];
        if (!files.includes(file)) return next();
        res.setHeader('Content-Type', type(file));
        createReadStream(resolve(dir, file)).pipe(res);
      });
    },
    generateBundle() {
      for (const file of files) {
        this.emitFile({ type: 'asset', fileName: `mediapipe/${file}`, source: readFileSync(resolve(dir, file)) });
      }
    },
  };
}

// Två sidor: kontrollpanelen (index.html) och scenen på projektorn (stage.html).
export default defineConfig({
  plugins: [react(), tailwindcss(), mediapipeWasm()],
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      input: {
        panel: resolve(import.meta.dirname, 'index.html'),
        stage: resolve(import.meta.dirname, 'stage.html'),
      },
    },
  },
  test: {
    environment: 'node',
    env: { TZ: 'Europe/Stockholm' },
  },
});
