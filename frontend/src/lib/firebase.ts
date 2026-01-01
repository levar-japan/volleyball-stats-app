import { initializeApp, getApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, connectAuthEmulator, Auth } from "firebase/auth";
import { logger } from "./logger";

// getFirestore と関連するインポートを削除

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// 環境変数のバリデーション
const requiredEnvVars = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
];

const missingVars = requiredEnvVars.filter(
  (varName) => !process.env[varName] || process.env[varName]?.includes('your-')
);

const hasValidConfig = missingVars.length === 0 && 
  firebaseConfig.apiKey && 
  firebaseConfig.projectId;

// 環境変数が設定されている場合のみFirebaseを初期化
let app: FirebaseApp | null = null;
let auth: Auth | null = null;

if (hasValidConfig) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
  } catch (error) {
    if (typeof window !== 'undefined') {
      logger.error('Firebase初期化エラー:', error);
    }
  }
}
// 環境変数が設定されていない場合は、エラーメッセージを表示せずに静かに失敗

// db の初期化とオフライン設定をここから削除

// エミュレーター接続は、USE_FIREBASE_EMULATOR環境変数が設定されている場合のみ
if (
  auth &&
  typeof window !== 'undefined' && 
  process.env.NODE_ENV === 'development' &&
  process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true'
) {
  try {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  } catch (_error) {
    logger.warn("Auth Emulator already connected or failed to connect:", _error);
  }
}

export { app, auth }; // db をエクスポートから削除