"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import { Firestore } from 'firebase/firestore';
import { app, auth, db } from '@/lib/firebase';

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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    // コンポーネントがアンマウントされる時に監視を解除
    return () => unsubscribe();
  }, []); // 依存配列は空で、マウント時に一度だけ実行

  // 認証状態の読み込みが完了するまで、シンプルなローディング表示
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <p>認証情報を確認中...</p>
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
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
};