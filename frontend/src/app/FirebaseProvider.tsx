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
import { getAuth, onAuthStateChanged, signInAnonymously, User } from "firebase/auth";
import { useSearchParams } from "next/navigation";
 
 const firebaseConfig = {
   apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
   authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
   projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
   // 省略可: storageBucket, messagingSenderId, appId
 };
 
 const app = initializeApp(firebaseConfig);
 const db = getFirestore(app);
// エミュレータ利用（任意）：.env.local に NEXT_PUBLIC_USE_EMULATOR=1 を入れた場合のみ
if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_USE_EMULATOR === "1") {
  try {
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
    // eslint-disable-next-line no-console
    console.log("[Firebase] Firestore emulator connected");
  } catch {}
}
 const auth = getAuth(app);
 
type TeamInfo = { id: string };
type Ctx = { db: ReturnType<typeof getFirestore>; authUser: User | null; teamInfo: TeamInfo | null };
const Ctx = createContext<Ctx>({ db, authUser: null, teamInfo: null });
 
 export function FirebaseProvider({ children }: { children: React.ReactNode }) {
   const [authUser, setAuthUser] = useState<User | null>(null);
   const [ready, setReady] = useState(false);
  const [teamInfo, setTeamInfo] = useState<TeamInfo | null>(null);
  const searchParams = useSearchParams();
 
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
 
  // 認証後：teamId を解決 → members/{uid} を作成（参加登録） → teamInfo セット
  useEffect(() => {
    if (!ready || !authUser) return;

    (async () => {
      // 1) teamId の取得優先度：URL ?team=xxx > localStorage("teamId")
      let teamId = searchParams?.get("team") || null;
      if (!teamId && typeof window !== "undefined") {
        teamId = window.localStorage.getItem("teamId");
      }
      if (!teamId) {
        console.warn("[FirebaseProvider] teamId not provided. Append ?team=<TEAM_ID> or set localStorage('teamId').");
        setTeamInfo(null);
        return;
      }

      // 2) チームの存在確認（teams/{teamId} は未認証でも read 可のルール想定）
      const teamRef = doc(db, `teams/${teamId}`);
      const teamSnap = await getDoc(teamRef);
      if (!teamSnap.exists()) {
        console.error("[FirebaseProvider] teams/<teamId> not found:", teamId);
        setTeamInfo(null);
        return;
      }

      // 3) members/{uid} を merge 作成（初回参加時）
      const memberRef = doc(db, `teams/${teamId}/members/${authUser.uid}`);
      await setDoc(
        memberRef,
        { joinedAt: serverTimestamp(), uid: authUser.uid },
        { merge: true }
      );

      // 4) teamInfo を Context へ
      setTeamInfo({ id: teamId });

      // 5) 取得した teamId を保存（次回以降 URL パラメータ不要）
      if (typeof window !== "undefined") {
        window.localStorage.setItem("teamId", teamId);
      }
    })().catch((e) => {
      console.error("[FirebaseProvider] setup team membership failed:", e);
      setTeamInfo(null);
    });
  }, [ready, authUser, searchParams]);

   if (!ready) {
     return <div className="min-h-screen flex items-center justify-center">認証初期化中...</div>;
   }
 
  return <Ctx.Provider value={{ db, authUser, teamInfo }}>{children}</Ctx.Provider>;
 }
 
 export const useFirebase = () => useContext(Ctx);
