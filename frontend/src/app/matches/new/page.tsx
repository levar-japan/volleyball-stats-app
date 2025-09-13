"use client";
import { useState, FormEvent, useEffect } from 'react';
import { useFirebase } from '@/app/FirebaseProvider';
import { useRouter } from 'next/navigation';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import Link from 'next/link';

interface TeamInfo { id: string; name: string; }

export default function NewMatchPage() {
  const { db, user } = useFirebase();
  const router = useRouter();
  
  const [teamInfo, setTeamInfo] = useState<TeamInfo | null>(null);
  const [opponent, setOpponent] = useState('');
  const [venue, setVenue] = useState('');
  const [matchDate, setMatchDate] = useState(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const storedTeam = localStorage.getItem('currentTeam');
    if (storedTeam) {
      setTeamInfo(JSON.parse(storedTeam));
    }
  }, []);

  const handleCreateMatch = async (e: FormEvent) => {
    e.preventDefault();
    if (!opponent.trim() || !teamInfo?.id || !user) {
      setError("対戦相手は必須です。");
      return;
    }
    setLoading(true);
    try {
      await addDoc(collection(db, `teams/${teamInfo.id}/matches`), {
        opponent: opponent.trim(), 
        venue: venue.trim() || null, 
        matchDate: new Date(matchDate),
        status: 'scheduled', 
        rules: { sets_to_win: 3, points_to_win_normal: 25, points_to_win_final: 15, deuce: true },
        createdAt: serverTimestamp(), 
        createdBy: user.uid,
      });
      alert("新しい試合を作成しました！");
      router.push('/dashboard');
    } catch (err) {
      console.error(err); 
      setError("試合の作成に失敗しました。"); 
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-8 bg-gray-100">
      <div className="w-full max-w-lg">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">新しい試合を作成</h1>
        <div className="bg-white p-8 rounded-lg shadow-md">
          <form onSubmit={handleCreateMatch}>
            <div className="mb-4">
              <label htmlFor="opponent" className="block text-gray-700 text-sm font-bold mb-2">対戦相手 *</label>
              <input id="opponent" type="text" value={opponent} onChange={(e) => setOpponent(e.target.value)} className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-900 leading-tight focus:outline-none focus:shadow-outline" required />
            </div>
            <div className="mb-4">
              <label htmlFor="venue" className="block text-gray-700 text-sm font-bold mb-2">会場 (任意)</label>
              <input id="venue" type="text" value={venue} onChange={(e) => setVenue(e.target.value)} className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-900 leading-tight focus:outline-none focus:shadow-outline" />
            </div>
            <div className="mb-6">
              <label htmlFor="matchDate" className="block text-gray-700 text-sm font-bold mb-2">試合日</label>
              <input id="matchDate" type="date" value={matchDate} onChange={(e) => setMatchDate(e.target.value)} className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-900 leading-tight focus:outline-none focus:shadow-outline" />
            </div>
            {error && <p className="text-red-500 text-xs italic mb-4">{error}</p>}
            <div className="flex items-center justify-between">
              <Link href="/dashboard"><span className="inline-block align-baseline font-bold text-sm text-blue-600 hover:text-blue-800">キャンセル</span></Link>
              <button type="submit" disabled={loading || !teamInfo?.id} className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:bg-gray-400">
                {loading ? '作成中...' : '試合を作成'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}