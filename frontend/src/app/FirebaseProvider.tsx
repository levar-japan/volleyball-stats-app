"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import { Firestore } from 'firebase/firestore';
import { app, auth, db } from '@/lib/firebase';
import { usePathname, useRouter } from 'next/navigation'; // ★Next.jsのHooksをインポート

interface FirebaseContextType {
  app: typeof app;
  auth: Auth;
  db: Firestore;
  user: User | null;
  loading: boolean;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  // ★★★★★ ここから追加 ★★★★★
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 認証状態の読み込み完了後にリダイレクト処理を実行
  useEffect(() => {
    if (loading) return; // 読み込み中はなにもしない

    const isAuthPage = pathname === '/'; // 参加ページかどうか

    if (user && isAuthPage) {
      // ログイン済み なのに 参加ページ にいる場合
      router.push('/dashboard'); // ダッシュボードへ
    }
    
    if (!user && !isAuthPage) {
      // 未ログイン なのに 参加ページ以外 にいる場合
      router.push('/'); // 参加ページへ
    }
  }, [user, loading, pathname, router]);
  // ★★★★★ ここまで追加 ★★★★★

  const value = { app, auth, db, user, loading };

  // 読み込み中、または適切なページにリダイレクトされるまでは何も表示しない
  if (loading || (user && pathname === '/') || (!user && pathname !== '/')) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <FirebaseContext.Provider value={value}>
      {children}
    </FirebaseContext.Provider>
  );
}

export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
};