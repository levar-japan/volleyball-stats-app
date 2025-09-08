"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import { Firestore } from 'firebase/firestore';
import { app, auth, db } from '@/lib/firebase';
import { usePathname, useRouter } from 'next/navigation';

interface FirebaseContextType {
  auth: Auth;
  db: Firestore;
  user: User | null;
  loading: boolean;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 認証状態の読み込み中は、常にローディング画面を表示
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <p>認証情報を確認中...</p>
      </div>
    );
  }

  const isAuthPage = pathname === '/';
  const isProtectedPage = pathname.startsWith('/dashboard') || pathname.startsWith('/matches');

  // --- 新しいリダイレクトロジック ---
  // ログイン済み なのに 参加ページ にいる場合
  if (user && isAuthPage) {
    router.push('/dashboard');
    // リダイレクト中はローディング画面を表示
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <p>ダッシュボードへ移動中...</p>
      </div>
    );
  }

  // 未ログイン なのに 保護されたページ にいる場合
  if (!user && isProtectedPage) {
    router.push('/');
    // リダイレクト中はローディング画面を表示
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <p>ログインページへ移動中...</p>
      </div>
    );
  }
  
  // 上記の条件に当てはまらない場合（＝適切なページにいる場合）は、子コンポーネントを表示
  return (
    <FirebaseContext.Provider value={{ auth, db, user, loading }}>
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