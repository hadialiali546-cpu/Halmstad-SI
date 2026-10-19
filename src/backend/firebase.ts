// Firebase bootstrap. On Firebase Hosting the web config is served automatically at
// /__/firebase/init.json, so no keys live in the code. Anywhere else (local dev, the
// standalone HTML file, or "offline demo" chosen on the login screen) the app runs in
// local mode with browser storage.
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, type Firestore } from 'firebase/firestore';

export interface FirebaseHandles { app: FirebaseApp; auth: Auth; fs: Firestore; projectId: string }
export type BackendMode = { mode: 'local' } | ({ mode: 'cloud' } & FirebaseHandles);

const OFFLINE_KEY = 'halmstad-si-offline-demo';
export const isOfflineChosen = () => { try { return sessionStorage.getItem(OFFLINE_KEY) === '1'; } catch { return false; } };
export const chooseOffline = (on: boolean) => {
  try { if (on) sessionStorage.setItem(OFFLINE_KEY, '1'); else sessionStorage.removeItem(OFFLINE_KEY); } catch { /* ignore */ }
};

// Written at build time by deploy-cloudshell.sh:
//   npx -y firebase-tools@latest apps:sdkconfig WEB <APP_ID> --project si-halmstad
const bundled = import.meta.glob('../firebase-config.json', { eager: true, import: 'default' }) as Record<string, Record<string, string>>;

async function loadConfig(): Promise<Record<string, string> | null> {
  const fromFile = Object.values(bundled)[0];
  if (fromFile?.apiKey && /^https?:$/.test(window.location.protocol)) return fromFile;
  const env = import.meta.env.VITE_FIREBASE_CONFIG as string | undefined;
  if (env) {
    try { return JSON.parse(env); } catch { /* fall through */ }
  }
  if (!/^https?:$/.test(window.location.protocol)) return null; // file:// (standalone HTML)
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch('/__/firebase/init.json', { signal: ctrl.signal, cache: 'no-store' });
    clearTimeout(t);
    if (!res.ok) return null;
    const json = await res.json();
    return json?.apiKey && json?.projectId ? json : null;
  } catch {
    return null;
  }
}

let cached: Promise<BackendMode> | null = null;
export function initBackend(): Promise<BackendMode> {
  if (cached) return cached;
  cached = (async () => {
    if (isOfflineChosen()) return { mode: 'local' } as const;
    const config = await loadConfig();
    if (!config) return { mode: 'local' } as const;
    const app = initializeApp(config);
    const auth = getAuth(app);
    let fs: Firestore;
    try {
      fs = import.meta.env.VITE_USE_EMULATORS === '1'
        ? initializeFirestore(app, { ignoreUndefinedProperties: true })
        : initializeFirestore(app, { ignoreUndefinedProperties: true, localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
    } catch {
      fs = initializeFirestore(app, { ignoreUndefinedProperties: true });
    }
    if (import.meta.env.VITE_USE_EMULATORS === '1') {
      // local testing against the Firebase Emulator Suite
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      connectFirestoreEmulator(fs, '127.0.0.1', 8080);
    }
    return { mode: 'cloud', app, auth, fs, projectId: config.projectId } as const;
  })();
  return cached;
}
