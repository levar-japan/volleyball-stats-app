"use client";
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import { Firestore, getFirestore, connectFirestoreEmulator, enableIndexedDbPersistence, onSnapshotsInSync } from 'firebase/firestore';
import { auth, app } from '@/lib/firebase'; // app をインポート
import { usePathname, useRouter } from 'next/navigation';
import { logger } from '@/lib/logger';

interface FirebaseContextType {
  auth: Auth | null;
  db: Firestore | null; // dbがnullになる可能性を許容
  user: User | null;
  loading: boolean;
  isOnline: boolean;
  isFirestoreSynced: boolean;
}
const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [db, setDb] = useState<Firestore | null>(null); // dbをStateで管理
  const [isOnline, setIsOnline] = useState(true);
  const [isFirestoreSynced, setIsFirestoreSynced] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // このuseEffectはクライアントサイドでのみ実行される
    if (!app || !auth) {
      // Firebaseが初期化されていない場合は、ローディングを終了してエラーを表示
      setLoading(false);
      return;
    }

    const firestoreDb = getFirestore(app);

    enableIndexedDbPersistence(firestoreDb)
      .then(() => {
        logger.info("Firestore offline persistence enabled.");
      })
      .catch((err) => {
        if (err.code == 'failed-precondition') {
          logger.warn("Firestore offline persistence failed: Multiple tabs open?");
        } else if (err.code == 'unimplemented') {
          logger.warn("Firestore offline persistence is not supported in this browser.");
        }
      });

    // ネットワーク接続状態を監視
    const handleOnline = () => {
      setIsOnline(true);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setIsFirestoreSynced(false);
    };

    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    // Firestoreの同期状態を監視（データベース初期化後）
    const syncUnsubscribe = onSnapshotsInSync(firestoreDb, () => {
      if (navigator.onLine) {
        setIsFirestoreSynced(true);
      }
    });

    // エミュレーター接続は、USE_FIREBASE_EMULATOR環境変数が設定されている場合のみ
    if (
      process.env.NODE_ENV === 'development' &&
      process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true'
    ) {
      try {
        connectFirestoreEmulator(firestoreDb, '127.0.0.1', 8080);
        logger.info("Firestore Emulator connected.");
      } catch {
        // Emulator already connected
      }
    }
    
    setDb(firestoreDb); // 初期化済みのdbインスタンスをStateにセット

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    
    return () => {
      unsubscribe();
      syncUnsubscribe();
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
    };
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
    <FirebaseContext.Provider value={{ auth, db, user, loading, isOnline, isFirestoreSynced }}>
      {children}
    </FirebaseContext.Provider>
  );
}
export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (context === undefined) throw new Error('useFirebase must be used within a FirebaseProvider');
  return context;
};