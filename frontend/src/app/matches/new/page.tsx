"use client";
import { useState, FormEvent, useEffect } from 'react';
import { useFirebase } from '@/app/FirebaseProvider';
import { useRouter } from 'next/navigation';
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy } from 'firebase/firestore';
import Link from 'next/link';

interface TeamInfo { id: string; name: string; }

export default function NewMatchPage() {
  const { db, user } = useFirebase();
  const router = useRouter();
  
  const [teamInfo, setTeamInfo] = useState<TeamInfo | null>(null);
  const [opponent, setOpponent] = useState('');
  const [venue, setVenue] = useState('');
  const [matchDate, setMatchDate] = useState(new Date().toISOString().split('T')[0]);
  const [seasonId, setSeasonId] = useState<string>('');
  const [seasons, setSeasons] = useState<Array<{ id: string; name: string; startDate: Date; endDate: Date }>>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const storedTeam = localStorage.getItem('currentTeam');
    if (storedTeam) {
      setTeamInfo(JSON.parse(storedTeam));
    }
  }, []);

  useEffect(() => {
    const fetchSeasons = async () => {
      if (!db || !teamInfo?.id) return;
      try {
        const seasonsRef = collection(db, `teams/${teamInfo.id}/seasons`);
        const q = query(seasonsRef, orderBy('startDate', 'desc'));
        const snapshot = await getDocs(q);
        const seasonsData = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name,
            startDate: data.startDate?.toDate() || new Date(),
            endDate: data.endDate?.toDate() || new Date(),
          };
        });
        setSeasons(seasonsData);
        if (seasonsData.length > 0 && !seasonId) {
          // 最新のアクティブなシーズンを自動選択
          const activeSeason = seasonsData.find(s => 
            s.startDate <= new Date() && s.endDate >= new Date()
          ) || seasonsData[0];
          setSeasonId(activeSeason.id);
        }
      } catch (err) {
        console.error('シーズン取得エラー:', err);
      }
    };
    fetchSeasons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, teamInfo?.id]);

  const handleCreateMatch = async (e: FormEvent) => {
    e.preventDefault();
    if (!db || !teamInfo?.id || !user) {
      setError("システムエラーが発生しました。ページを再読み込みしてください。");
      return;
    }
    if (!opponent.trim()) {
      setError("対戦相手は必須です。");
      return;
    }
    setLoading(true);
    try {
      await addDoc(collection(db, `teams/${teamInfo.id}/matches`), {
        opponent: opponent.trim(), 
        venue: venue.trim() || null, 
        matchDate: new Date(matchDate),
        seasonId: seasonId || null,
        status: 'scheduled', 
        rules: { sets_to_win: 3, points_to_win_normal: 25, points_to_win_final: 15, deuce: true },
        createdAt: serverTimestamp(), 
        createdBy: user.uid,
      });
      router.push('/dashboard');
    } catch (err) {
      console.error(err); 
      setError("試合の作成に失敗しました。"); 
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="text-gray-600 hover:text-gray-900 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                新しい試合を作成
              </h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
          <form onSubmit={handleCreateMatch} className="space-y-6">
            <div>
              <label htmlFor="opponent" className="block text-gray-700 text-sm font-semibold mb-2">
                対戦相手 <span className="text-red-500">*</span>
              </label>
              <input
                id="opponent"
                type="text"
                value={opponent}
                onChange={(e) => setOpponent(e.target.value)}
                className="w-full py-3 px-4 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                placeholder="対戦相手名を入力"
                required
              />
            </div>
            
            <div>
              <label htmlFor="venue" className="block text-gray-700 text-sm font-semibold mb-2">
                会場 <span className="text-gray-500 text-xs">(任意)</span>
              </label>
              <input
                id="venue"
                type="text"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                className="w-full py-3 px-4 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                placeholder="会場名を入力"
              />
            </div>
            
            <div>
              <label htmlFor="matchDate" className="block text-gray-700 text-sm font-semibold mb-2">
                試合日
              </label>
              <input
                id="matchDate"
                type="date"
                value={matchDate}
                onChange={(e) => setMatchDate(e.target.value)}
                className="w-full py-3 px-4 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>
            
            <div>
              <label htmlFor="seasonId" className="block text-gray-700 text-sm font-semibold mb-2">
                シーズン <span className="text-gray-500 text-xs">(任意)</span>
              </label>
              <select
                id="seasonId"
                value={seasonId}
                onChange={(e) => setSeasonId(e.target.value)}
                className="w-full py-3 px-4 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              >
                <option value="">シーズンを選択しない</option>
                {seasons.map(season => (
                  <option key={season.id} value={season.id}>{season.name}</option>
                ))}
              </select>
            </div>
            
            {error && (
              <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-red-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-red-700 text-sm font-medium">{error}</p>
                </div>
              </div>
            )}
            
            <div className="flex items-center justify-end gap-4 pt-4 border-t border-gray-200">
              <Link href="/dashboard">
                <span className="px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors">
                  キャンセル
                </span>
              </Link>
              <button
                type="submit"
                disabled={loading || !teamInfo?.id}
                className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-lg shadow-md transition-all hover:shadow-lg hover:scale-105 disabled:bg-gray-300 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    作成中...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    試合を作成
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}