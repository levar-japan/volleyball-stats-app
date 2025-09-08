import { initializeApp, getApp, getApps } from "firebase/app";
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

// Vercelのビルドプロセス(サーバーサイド)でエラーにならないように、
// クライアントサイドでのみFirebaseを初期化する
const app = typeof window !== 'undefined' && !getApps().length
  ? initializeApp(firebaseConfig)
  : getApp();

const auth = getAuth(app);
const db = getFirestore(app);

// ローカルでの開発時のみ、Emulatorに接続する
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  // ホットリロード時の二重接続を防ぐためのチェック
  // @ts-ignore
  if (!auth.emulatorConfig) {
    console.log("Connecting to Auth Emulator...");
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  }
  // @ts-ignore
  if (!db._settings.host.includes('localhost')) {
    console.log("Connecting to Firestore Emulator...");
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
}

export { app, auth, db };