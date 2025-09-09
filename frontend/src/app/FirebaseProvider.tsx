// app/FirebaseProvider.tsx （例）
"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, onAuthStateChanged, signInAnonymously, User } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  // 省略可: storageBucket, messagingSenderId, appId
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

type Ctx = { db: ReturnType<typeof getFirestore>; authUser: User | null; teamInfo?: { id: string } | null };
const Ctx = createContext<Ctx>({ db, authUser: null, teamInfo: null });

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        try { await signInAnonymously(auth); } 
        catch (e) { console.error("anonymous sign-in failed", e); }
      } else {
        setAuthUser(u);
        setReady(true);
      }
    });
    return () => unsub();
  }, []);

  if (!ready) {
    return <div className="min-h-screen flex items-center justify-center">認証初期化中...</div>;
  }

  // teamInfo はあなたのロジックでセット
  const teamInfo = /* 例: Zustand/Context/URL から */ null;

  return <Ctx.Provider value={{ db, authUser, teamInfo }}>{children}</Ctx.Provider>;
}

export const useFirebase = () => useContext(Ctx);
