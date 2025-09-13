"use client";

import { User as FirebaseUser, onAuthStateChanged } from "firebase/auth";
import { ReactNode, createContext, useContext, useEffect, useState } from "react";
import { auth } from "./firebase";

// FirebaseのUser型を拡張して、アプリケーション独自のプロパティを追加
export interface User extends FirebaseUser {
  teams?: string[]; // ユーザーが所属するチームIDの配列
}

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextType>({ user: null, isLoading: true });

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      // ユーザーオブジェクトをアプリケーションのUser型にキャスト
      setUser(firebaseUser as User | null);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const value = { user, isLoading };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  return useContext(AuthContext);
};