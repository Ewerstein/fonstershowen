import { POSE_MODEL_URLS } from './models';
import { themeBase } from './theme';

/** Registrerar service workern som gör att showen fungerar utan internet. Bara i den byggda appen. */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);
}

export interface OfflineReadiness {
  /** Service workern styr sidan. */
  worker: boolean;
  /** Scenen och temat finns sparade. */
  show: boolean;
  /** WebAssembly och kroppsmodellen finns sparade. */
  camera: boolean;
}

async function has(url: string): Promise<boolean> {
  try {
    return (await caches.match(new URL(url, location.href).toString(), { ignoreSearch: true })) !== undefined;
  } catch {
    return false;
  }
}

export async function offlineReadiness(themeId: string): Promise<OfflineReadiness> {
  const worker = typeof navigator !== 'undefined' && !!navigator.serviceWorker?.controller;
  if (typeof caches === 'undefined') return { worker, show: false, camera: false };
  const base = import.meta.env.BASE_URL;
  const show = (await has(`${base}stage.html`)) && (await has(`${themeBase(themeId)}manifest.json`));
  const wasm = (await has(`${base}mediapipe/vision_wasm_internal.wasm`)) || (await has(`${base}mediapipe/vision_wasm_nosimd_internal.wasm`));
  let model = false;
  for (const url of POSE_MODEL_URLS) if (await has(url)) model = true;
  return { worker, show, camera: wasm && model };
}
