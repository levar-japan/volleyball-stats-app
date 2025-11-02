"use client";
import { useState, useEffect } from 'react';
import { useFirebase } from './FirebaseProvider';
import { useRouter } from 'next/navigation';
import { signInAnonymously } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';

export default function Home() {
  const { auth, db, user, loading } = useFirebase();
  const router = useRouter();
  const [teamCode, setTeamCode] = useState('');
  const [error, setError] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    // ユーザーが既にログイン済みで、チーム情報もlocalStorageにあればダッシュボードへ
    if (!loading && user) {
      const storedTeam = localStorage.getItem('currentTeam');
      if (storedTeam) {
        router.push('/dashboard');
      }
    }
  }, [user, loading, router]);

  const handleJoinTeam = async () => {
    const trimmedCode = teamCode.trim();
    if (trimmedCode.length !== 4) {
      setError('4桁のチームコードを入力してください。');
      return;
    }
    setIsJoining(true);
    setError('');
    try {
      if (!db) throw new Error("Firestore is not initialized");
      
      const q = query(collection(db, 'teams'), where('code4', '==', trimmedCode));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError('有効なチームコードではありません。');
        setIsJoining(false);
        return;
      }
      
      const teamData = querySnapshot.docs[0].data();
      const teamId = querySnapshot.docs[0].id;

      // localStorageに直接チーム情報を保存
      localStorage.setItem('currentTeam', JSON.stringify({ id: teamId, name: teamData.name }));

      // ユーザーがまだ認証されていなければ匿名認証を行う
      if (!user) {
        await signInAnonymously(auth);
        // 認証後、onAuthStateChangedでリダイレクトされるためここでは待機
      } else {
        // 既に（別のチームなどで）認証済みなら、そのままダッシュボードへ
        router.push('/dashboard');
      }
      
    } catch (err) {
      console.error(err);
      setError('参加中にエラーが発生しました。');
      setIsJoining(false);
    }
  };

  // 読み込み中か、既にログイン済みでリダイレクト待ちの場合はローディング表示
  if (loading || user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center animate-pulse">
            <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <p className="text-gray-600 font-medium">読み込んでいます...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
              チームに参加
            </h1>
            <p className="text-gray-600 text-sm">4桁のチームコードを入力してください</p>
          </div>
          
          <form onSubmit={(e) => { e.preventDefault(); handleJoinTeam(); }}>
            <div className="mb-6">
              <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="team-code">
                チームコード
              </label>
              <input 
                id="team-code" 
                type="text" 
                value={teamCode} 
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
                  setTeamCode(value);
                  if (error && value.length === 4) {
                    setError('');
                  }
                }} 
                maxLength={4} 
                className="w-full py-3 px-4 border border-gray-300 rounded-lg text-gray-900 text-center text-2xl font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" 
                placeholder="0000" 
              />
            </div>
            
            {error && (
              <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-red-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-red-700 text-sm font-medium">{error}</p>
                </div>
              </div>
            )}
            
            <button 
              type="submit"
              onClick={handleJoinTeam} 
              disabled={isJoining || teamCode.length !== 4} 
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-4 px-6 rounded-xl shadow-lg transition-all hover:shadow-xl hover:scale-[1.02] disabled:bg-gray-300 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
            >
              {isJoining ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  参加中...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  参加する
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}