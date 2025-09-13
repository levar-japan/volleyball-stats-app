"use client";

import { createContext, useContext, ReactNode } from "react";
import { db } from "./firebase"; // firebase.ts から db をインポート
import { Firestore } from "firebase/firestore";

// TypeScriptのための型定義
type FirebaseContextType = {
  db: Firestore;
};

// データベース接続情報を入れるための「箱」（Context）
const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

// この箱をアプリケーション全体に提供するための部品（プロバイダー）
export const FirebaseProvider = ({ children }: { children: ReactNode }) => {
  return <FirebaseContext.Provider value={{ db }}>{children}</FirebaseContext.Provider>;
};

// どのページからでも簡単にdb情報を取り出すための命令（カスタムフック）
export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error("useFirebase must be used within a FirebaseProvider");
  }
  return context;
};