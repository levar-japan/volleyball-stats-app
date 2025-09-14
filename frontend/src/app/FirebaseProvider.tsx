"use client";
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import { Firestore, getFirestore, connectFirestoreEmulator, enableIndexedDbPersistence } from 'firebase/firestore';
import { auth, app } from '@/lib/firebase'; // app をインポート
import { usePathname, useRouter } from 'next/navigation';

interface FirebaseContextType {
  auth: Auth;
  db: Firestore | null; // dbがnullになる可能性を許容
  user: User | null;
  loading: boolean;
}
const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [db, setDb] = useState<Firestore | null>(null); // dbをStateで管理
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // このuseEffectはクライアントサイドでのみ実行される
    const firestoreDb = getFirestore(app);

    enableIndexedDbPersistence(firestoreDb)
      .then(() => {
        console.log("Firestore offline persistence enabled.");
      })
      .catch((err) => {
        if (err.code == 'failed-precondition') {
          console.warn("Firestore offline persistence failed: Multiple tabs open?");
        } else if (err.code == 'unimplemented') {
          console.warn("Firestore offline persistence is not supported in this browser.");
        }
      });

    if (process.env.NODE_ENV === 'development') {
      try {
        connectFirestoreEmulator(firestoreDb, '127.0.0.1', 8080);
        console.log("Firestore Emulator connected.");
      } catch (e) {
        // console.warn("Firestore Emulator already connected.");
      }
    }
    
    setDb(firestoreDb); // 初期化済みのdbインスタンスをStateにセット

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (loading) return;
    const isAuthPage = pathname === '/';
    const isProtectedPage = pathname.startsWith('/dashboard') || pathname.startsWith('/matches');

    if (!user && isProtectedPage) {
      router.push('/');
    }
    if (user && isAuthPage) {
      const storedTeam = localStorage.getItem('currentTeam');
      if (storedTeam) {
        router.push('/dashboard');
      }
    }
  }, [user, loading, pathname, router]);

  if (loading || !db) { // dbが初期化されるまでローディング
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <p>アプリケーションを初期化中...</p>
      </div>
    );
  }

  return (
    <FirebaseContext.Provider value={{ auth, db, user, loading }}>
      {children}
    </FirebaseContext.Provider>
  );
}
export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (context === undefined) throw new Error('useFirebase must be used within a FirebaseProvider');
  return context;
};