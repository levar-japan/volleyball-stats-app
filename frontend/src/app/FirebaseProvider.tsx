"use client";
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import { Firestore } from 'firebase/firestore';
import { app, auth, db } from '@/lib/firebase';
import { usePathname, useRouter } from 'next/navigation';

interface TeamInfo {
  id: string;
  name: string;
}
interface FirebaseContextType {
  auth: Auth;
  db: Firestore;
  user: User | null;
  loading: boolean;
  teamInfo: TeamInfo | null;
  setTeamInfo: (team: TeamInfo | null) => void;
}
const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [teamInfo, setTeamInfoState] = useState<TeamInfo | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (user) {
        try {
          const storedTeam = localStorage.getItem('currentTeam');
          if (storedTeam) {
            setTeamInfoState(JSON.parse(storedTeam));
          }
        } catch (e) {
          console.error("Failed to parse team info from localStorage", e);
          localStorage.removeItem('currentTeam');
        }
      } else {
        localStorage.removeItem('currentTeam');
        setTeamInfoState(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);
  
  const setTeamInfo = (team: TeamInfo | null) => {
    if (team) {
      localStorage.setItem('currentTeam', JSON.stringify(team));
      setTeamInfoState(team);
    } else {
      localStorage.removeItem('currentTeam');
      setTeamInfoState(null);
    }
  };

  useEffect(() => {
    if (loading) return;
    const isAuthPage = pathname === '/';
    const isProtectedPage = pathname.startsWith('/dashboard') || pathname.startsWith('/matches');
    if (user && teamInfo && isAuthPage) {
      router.push('/dashboard');
    }
    if ((!user || !teamInfo) && isProtectedPage) {
      router.push('/');
    }
  }, [user, loading, pathname, router, teamInfo]);

  if (loading) return (<div className="flex min-h-screen items-center justify-center bg-gray-100"><p>認証情報を確認中...</p></div>);
  return (<FirebaseContext.Provider value={{ auth, db, user, loading, teamInfo, setTeamInfo }}>{children}</FirebaseContext.Provider>);
}
export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (context === undefined) throw new Error('useFirebase must be used within a FirebaseProvider');
  return context;
};