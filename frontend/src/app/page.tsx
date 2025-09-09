"use client";
import { useState, useEffect } from 'react';
import { useFirebase } from './FirebaseProvider';
import { useRouter } from 'next/navigation';
import { signInAnonymously } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';

export default function Home() {
  const { auth, db, user, loading, setTeamInfo, teamInfo } = useFirebase();
  const router = useRouter();
  const [teamCode, setTeamCode] = useState('');
  const [error, setError] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    if (!loading && user && teamInfo) {
      router.push('/dashboard');
    }
  }, [user, loading, router, teamInfo]);

  const handleJoinTeam = async () => {
    if (teamCode.length !== 4) {
      setError('4桁のチームコードを入力してください。');
      return;
    }
    setIsJoining(true);
    setError('');
    try {
      if (!db) throw new Error("Firestore is not initialized");
      const q = query(collection(db, 'teams'), where('code4', '==', teamCode));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        setError('有効なチームコードではありません。');
        setIsJoining(false);
        return;
      }
      
      const teamData = querySnapshot.docs[0].data();
      const teamId = querySnapshot.docs[0].id;

      setTeamInfo({ id: teamId, name: teamData.name });

      if (!user) {
        await signInAnonymously(auth);
      }
      
    } catch (err) {
      console.error(err);
      setError('参加中にエラーが発生しました。');
      setIsJoining(false);
    }
  };

  if (loading || (user && teamInfo)) {
    return (
       <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-100">
        <p>読み込んでいます...</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-100">
      <div className="w-full max-w-xs">
        <h1 className="text-center text-2xl font-bold mb-6 text-gray-800">チームに参加</h1>
        <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="team-code">4桁のチームコード</label>
            <input
              id="team-code"
              type="text"
              value={teamCode}
              onChange={(e) => setTeamCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
              maxLength={4}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-900 leading-tight focus:outline-none focus:shadow-outline"
              placeholder="1234"
            />
          </div>
          {error && <p className="text-red-500 text-xs italic mb-4">{error}</p>}
          <div className="flex items-center justify-between">
            <button
              onClick={handleJoinTeam}
              disabled={isJoining}
              className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:bg-gray-400"
            >
              {isJoining ? '参加中...' : '参加する'}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
