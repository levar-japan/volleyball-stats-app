import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";

// Vercelに設定した環境変数から接続情報を読み込む
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Firebase Appを初期化
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ローカルでの開発時のみ、Emulatorに接続する
// process.env.NODE_ENV === 'development' は、`npm run dev`で起動した時にtrueになる
if (process.env.NODE_ENV === 'development') {
  console.log("Connecting to Firebase Emulator...");
  try {
    // ローカル開発サーバー(npm run dev)からDockerコンテナ内のEmulatorへ接続
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  } catch (error) {
    console.error("Failed to connect to Firebase Emulator", error);
  }
}

export { app, auth, db };