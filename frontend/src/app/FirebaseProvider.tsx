"use client";
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import { Firestore } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/firebase';
import { usePathname, useRouter } from 'next/navigation';

// teamInfoを削除
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
  
  // teamInfoとそれに関連するuseEffectを削除

  useEffect(() => {
    if (loading) return;
    const isAuthPage = pathname === '/';
    const isProtectedPage = pathname.startsWith('/dashboard') || pathname.startsWith('/matches');

    // 認証されていないユーザーが保護ページにアクセスしたらトップにリダイレクト
    if (!user && isProtectedPage) {
      router.push('/');
    }
    // 認証済みのユーザーがトップページにアクセスしたらダッシュボードにリダイレクト
    if (user && isAuthPage) {
      router.push('/dashboard');
    }
  }, [user, loading, pathname, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <p>認証情報を確認中...</p>
      </div>
    );
  }

  // valueからteamInfo, setTeamInfoを削除
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