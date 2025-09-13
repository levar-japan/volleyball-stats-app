import { initializeApp, getApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, connectAuthEmulator, Auth } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, Firestore, enableIndexedDbPersistence } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

const auth: Auth = getAuth(app);
const db: Firestore = getFirestore(app);

// --- ↓ ここからが修正箇所です ↓ ---

// ブラウザ環境でのみ永続性を有効にする
if (typeof window !== 'undefined') {
  try {
    enableIndexedDbPersistence(db)
      .then(() => {
        console.log("Firestoreのオフライン永続性を有効にしました。");
      })
      .catch((err) => {
        if (err.code == 'failed-precondition') {
          console.warn("複数のタブで開かれているため、Firestoreの永続化に失敗しました。");
        } else if (err.code == 'unimplemented') {
          console.error("お使いのブラウザはオフライン対応をサポートしていません。");
        }
      });
  } catch (error) {
    console.error("Firestoreの永続化設定中にエラーが発生しました:", error);
  }
}

// 開発環境かつブラウザ環境でのみエミュレータに接続する
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  try {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  } catch (_error) {
    console.warn("Emulator already connected or failed to connect:", _error);
  }
}

export { app, auth, db };