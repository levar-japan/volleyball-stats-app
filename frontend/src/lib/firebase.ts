import { initializeApp, getApps } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";

// Firebaseプロジェクトの設定
const firebaseConfig = {
  apiKey: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", // Emulator利用時はダミーでOK
  authDomain: "volleyball-stats-app-dev.firebaseapp.com",
  projectId: "volleyball-stats-app-dev",
  storageBucket: "volleyball-stats-app-dev.appspot.com",
  messagingSenderId: "xxxxxxxxxxxx",
  appId: "x:xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
};

// Firebase Appを初期化
const app = initializeApp(firebaseConfig);

// AuthとFirestoreのインスタンスを取得
const auth = getAuth(app);
const db = getFirestore(app);

// 開発環境（エミュレータ利用時）の接続設定
if (typeof window !== 'undefined' && window.location.hostname === "localhost") {
  console.log("Connecting to Firebase Emulator...");

  // すでに接続済みでなければ接続する（ホットリロードによる再接続防止）
  // @ts-ignore
  if (!auth.emulatorConfig) {
    connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
  }

  // @ts-ignore
  if (!db.emulatorConfig) {
    connectFirestoreEmulator(db, 'localhost', 8080);
  }
}

export { app, auth, db };