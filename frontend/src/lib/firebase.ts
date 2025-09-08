import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// --- グローバルスコープで一度だけ初期化するためのヘルパー ---
// これにより、Next.jsのホットリロード時にもインスタンスが再利用される
const initializeFirebaseApp = () => {
  if (getApps().length) {
    return getApp();
  }
  return initializeApp(firebaseConfig);
};

const app = initializeFirebaseApp();
const auth = getAuth(app);
const db = getFirestore(app);

// --- Emulatorへの接続 ---
// process.env.NODE_ENV === 'development' はビルド時には 'production' になるため、
// このブロックはローカル開発サーバーでしか実行されない
if (process.env.NODE_ENV === 'development') {
  // このフラグは、ホットリロードで何度も接続しようとするのを防ぐ
  // @ts-ignore
  if (!globalThis.__EMULATORS_CONNE