// src/app/FirebaseProvider.tsx
"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  connectFirestoreEmulator,
} from "firebase/firestore";
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  User,
} from "firebase/auth";
import { useSearchParams } from "next/navigation";

// ---- Firebase 初期化 ----
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  // 必要なら storageBucket, messagingSenderId, appId を追加
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
// エミュレータ利用（任意）：.env.local に NEXT_PUBLIC_USE_EMULATOR=1
if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_USE_EMULATOR === "1") {
  try {
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
    console.log("[Firebase] Firestore emulator connected");
  } catch {}
}
const auth = getAuth(app);

// ---- Context 型・生成 ----
type TeamInfo = { id: string };
type Ctx = {
  db: ReturnType<typeof getFirestore>;
  auth: ReturnType<typeof getAuth>;
  authUser: User | null;
  /** 旧API互換：user は authUser のエイリアス */
  user: User | null;
  /** 旧API互換：認証ロード中フラグ */
  loading: boolean;
  teamInfo: TeamInfo | null;
  /** 旧API互換：チーム切替用 setter を公開 */
  setTeamInfo: (t: TeamInfo | null) => void;
};
const Ctx = createContext<Ctx>({
  db,
  auth,
  authUser: null,
  user: null,
  loading: true,
  teamInfo: null,
  setTeamInfo: () => {},
});

// ---- Provider 本体 ----
export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [teamInfo, setTeamInfo] = useState<TeamInfo | null>(null);
  const searchParams = useSearchParams();

  // 1) 匿名サインイン完了まで待つ
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        try {
          await signInAnonymously(auth);
        } catch (e) {
          console.error("anonymous sign-in failed", e);
        }
      } else {
        setAuthUser(u);
        setReady(true);
      }
    });
    return () => unsub();
  }, []);

  // 2) 認証後：teamId を解決 → members/{uid} を作成（参加登録） → teamInfo をセット
  useEffect(() => {
    if (!ready || !authUser) return;

    (async () => {
      // 2-1) teamId の取得優先度：URL ?team=xxx > localStorage("teamId")
      let teamId = searchParams?.get("team") || null;
      if (!teamId && typeof window !== "undefined") {
        teamId = window.localStorage.getItem("teamId");
      }
      if (!teamId) {
        console.warn(
          "[FirebaseProvider] teamId not provided. Append ?team=<TEAM_ID> or set localStorage('teamId')."
        );
        setTeamInfo(null);
        return;
      }

      // 2-2) teams/{teamId} の存在確認（ルールで get/list 許可を想定）
      const teamRef = doc(db, `teams/${teamId}`);
      const teamSnap = await getDoc(teamRef);
      if (!teamSnap.exists()) {
        console.error("[FirebaseProvider] teams/<teamId> not found:", teamId);
        setTeamInfo(null);
        return;
      }

      // 2-3) members/{uid} を merge で作成（初回参加登録）
      const memberRef = doc(db, `teams/${teamId}/members/${authUser.uid}`);
      await setDoc(
        memberRef,
        { joinedAt: serverTimestamp(), uid: authUser.uid },
        { merge: true }
      );

      // 2-4) teamInfo を Context へ
      setTeamInfo({ id: teamId });

      // 2-5) 保存（次回以降 URL パラメータ不要）
      if (typeof window !== "undefined") {
        window.localStorage.setItem("teamId", teamId);
      }
    })().catch((e) => {
      console.error("[FirebaseProvider] setup team membership failed:", e);
      setTeamInfo(null);
    });
  }, [ready, authUser, searchParams]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        認証初期化中...
      </div>
    );
  }

  return (
    <Ctx.Provider
      value={{
        db,
        auth,
        authUser,
        user: authUser, // 旧API互換
        loading: !ready, // 旧API互換
        teamInfo,
        setTeamInfo, // 旧API互換
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

// ---- Hook ----
export const useFirebase = () => useContext(Ctx);