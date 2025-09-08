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

// クライアントサイドでのみFirebaseを初期化する
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const auth = getAuth(app);
const db = getFirestore(app);

// ローカルでの開発時（クライアントサイド）のみ、Emulatorに接続する
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.log("Connecting to Firebase Emulator...");
  try {
    // 既に接続済みでないことを確認してから接続
    if (!("_emulator" in auth)) {
      connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    }
    if (!("_settings" in db && db._settings.host)) {
      connectFirestoreEmulator(db, '127.0.0.1', 8080);
    }
  } catch (error) {
    console.error("Failed to connect to Firebase Emulator", error);
  }
}

export { app, auth, db };