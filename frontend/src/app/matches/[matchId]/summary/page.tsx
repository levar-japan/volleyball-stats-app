"use client";

import { useState, useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useFirebase } from '@/app/FirebaseProvider';
import { collection, getDocs, query, where } from 'firebase/firestore';

// 型定義
interface Player {
  id: string;
  displayName: string;
}
interface Event {
  playerId: string;
  type: string;
  result: string;
  setIndex: number;
}
interface ActionStats {
  success: number;
  fail: number;
  point: number;
  total: number;
  successRate: string;
}
interface ReceptionStats {
  a_pass: number;
  b_pass: number;
  c_pass: number;
  fail: number;
  total: number;
  successRate: string;
}
interface Stats {
  serve: ActionStats;
  spike: ActionStats;
  block: ActionStats;
  reception: ReceptionStats;
  dig: { success: number; fail: number; total: number; successRate: string; };
}

export default function SummaryPage() {
  const { db } = useFirebase();
  const pathname = usePathname();
  const matchId = pathname.split('/')[2] || '';

  const [players, setPlayers] = useState<Player[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'rate' | 'count'>('rate');
  const [totalSets, setTotalSets] = useState(0);
  const [selectedSet, setSelectedSet] = useState<number | 'all'>('all');

  useEffect(() => {
    if (!db || !matchId) {
      setLoading(false);
      setError("データベースまたは試合IDが無効です。");
      return;
    }
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const teamsQuery = query(collection(db, 'teams'), where('code4', '==', '1234'));
        const teamSnap = await getDocs(teamsQuery);
        if (teamSnap.empty) throw new Error("Team not found.");
        const teamId = teamSnap.docs[0].id;
        
        const playersSnap = await getDocs(collection(db, `teams/${teamId}/players`));
        setPlayers(playersSnap.docs.map(d => ({ ...d.data(), id: d.id } as Player)));

        const setsSnap = await getDocs(collection(db, `teams/${teamId}/matches/${matchId}/sets`));
        setTotalSets(setsSnap.size);
        const allEvents: Event[] = [];
        for (const setDoc of setsSnap.docs) {
          const eventsSnap = await getDocs(collection(setDoc.ref, 'events'));
          eventsSnap.forEach(eDoc => {
            const eventData = eDoc.data();
            if (eventData.playerId) {
              allEvents.push(eventData as Event);
            }
          });
        }
        setEvents(allEvents);
      } catch (err) { 
        setError((err as Error).message); 
      } 
      finally { 
        setLoading(false); 
      }
    };
    fetchData();
  }, [db, matchId]);

  const participatingPlayers = useMemo(() => {
    const participatingPlayerIds = new Set(events.map(e => e.playerId));
    return players.filter(p => participatingPlayerIds.has(p.id));
  }, [events, players]);

  const playerStats = useMemo(() => {
    const filteredEvents = selectedSet === 'all'
      ? events
      : events.filter(event => event.setIndex === selectedSet);

    const statsByPlayer: Record<string, Stats> = {};
    participatingPlayers.forEach(p => {
      statsByPlayer[p.id] = {
        serve: { success: 0, fail: 0, point: 0, total: 0, successRate: '0.0%' },
        spike: { success: 0, fail: 0, point: 0, total: 0, successRate: '0.0%' },
        block: { success: 0, fail: 0, point: 0, total: 0, successRate: '0.0%' },
        reception: { a_pass: 0, b_pass: 0, c_pass: 0, fail: 0, total: 0, successRate: '0.0%' },
        dig: { success: 0, fail: 0, total: 0, successRate: '0.0%' },
      };
    });

    filteredEvents.forEach(event => {
      if (!statsByPlayer[event.playerId]) return;
      const { type, result } = event;
      const playerStat = statsByPlayer[event.playerId];

      if (type === 'serve' || type === 'spike' || type === 'block') {
        const stat = playerStat[type];
        stat.total++;
        if (result === 'point') { stat.point++; stat.success++; }
        else if (result === 'success') { stat.success++; }
        else if (result === 'fail') { stat.fail++; }
      }
      else if (type === 'reception') {
        const stat = playerStat.reception;
        stat.total++;
        if (result === 'a-pass') stat.a_pass++;
        else if (result === 'b-pass') stat.b_pass++;
        else if (result === 'c-pass') stat.c_pass++;
        else if (result === 'fail') stat.fail++;
      }
      else if (type === 'dig') {
        const stat = playerStat.dig;
        stat.total++;
        if (result === 'success') stat.success++;
        else if (result === 'fail') stat.fail++;
      }
    });
    
    Object.values(statsByPlayer).forEach(stats => {
      const serveTotal = stats.serve.total;
      if (serveTotal > 0) stats.serve.successRate = `${(((stats.serve.point - stats.serve.fail) / serveTotal) * 100).toFixed(1)}%`;
      
      const spikeTotal = stats.spike.total;
      if (spikeTotal > 0) stats.spike.successRate = `${(((stats.spike.point - stats.spike.fail) / spikeTotal) * 100).toFixed(1)}%`;
      
      const blockTotal = stats.block.total;
      if (blockTotal > 0) stats.block.successRate = `${((stats.block.point / blockTotal) * 100).toFixed(1)}%`;

      const receptionTotal = stats.reception.total;
      if (receptionTotal > 0) stats.reception.successRate = `${(((stats.reception.a_pass + stats.reception.b_pass) / receptionTotal) * 100).toFixed(1)}%`;
      
      const digTotal = stats.dig.success + stats.dig.fail;
      if (digTotal > 0) stats.dig.successRate = `${((stats.dig.success / digTotal) * 100).toFixed(1)}%`;
    });

    return statsByPlayer;
  }, [events, participatingPlayers, selectedSet]);

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-gray-100"><p>集計データを読み込んでいます...</p></main>;
  if (error) return <main className="flex min-h-screen items-center justify-center bg-gray-100"><p className="text-red-500 max-w-md text-center">エラー: {error}</p></main>;

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="w-full max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">個人成績</h1>
          <Link href="/dashboard">
            <span className="text-sm text-blue-600 hover:text-blue-800">&larr; ダッシュボードに戻る</span>
          </Link>
        </header>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
            <div className="flex-grow">
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-6 overflow-x-auto">
                  <button onClick={() => setSelectedSet('all')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${selectedSet === 'all' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                    試合全体
                  </button>
                  {Array.from({ length: totalSets }, (_, i) => i + 1).map(setNum => (
                    <button key={setNum} onClick={() => setSelectedSet(setNum)} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${selectedSet === setNum ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                      第{setNum}セット
                    </button>
                  ))}
                </nav>
              </div>
            </div>
            <div className="inline-flex rounded-md shadow-sm">
              <button
                onClick={() => setViewMode('rate')}
                className={`px-4 py-2 text-sm font-medium rounded-l-lg border ${viewMode === 'rate' ? 'bg-blue-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              >
                率で表示
              </button>
              <button
                onClick={() => setViewMode('count')}
                className={`px-4 py-2 text-sm font-medium rounded-r-lg border ${viewMode === 'count' ? 'bg-blue-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              >
                数で表示
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                {viewMode === 'rate' ? (
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">選手名</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">サーブ<br/>効果率</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">アタック<br/>決定率</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">ブロック<br/>決定率</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">レセプション<br/>成功率 (A/B)</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">ディグ<br/>成功率</th>
                  </tr>
                ) : (
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">選手名</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">サーブ<br/>(得/失/総)</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">アタック<br/>(決/失/総)</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">ブロック<br/>(決/失/総)</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">レセプション<br/>(A/B/C/失/総)</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">ディグ<br/>(成/否/総)</th>
                  </tr>
                )}
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {participatingPlayers.map(player => {
                  const stats = playerStats[player.id];
                  if (!stats) return null;
                  return (
                    <tr key={player.id}>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{player.displayName}</td>
                      {viewMode === 'rate' ? (
                        <>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-800">{stats.serve.successRate}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-800">{stats.spike.successRate}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-800">{stats.block.successRate}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-800">{stats.reception.successRate}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-800">{stats.dig.successRate}</td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-800">{stats.serve.point} / {stats.serve.fail} / {stats.serve.total}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-800">{stats.spike.point} / {stats.spike.fail} / {stats.spike.total}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-800">{stats.block.point} / {stats.block.fail} / {stats.block.total}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-800">{stats.reception.a_pass}/{stats.reception.b_pass}/{stats.reception.c_pass}/{stats.reception.fail}/{stats.reception.total}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-800">{stats.dig.success} / {stats.dig.fail} / {stats.dig.total}</td>
                        </>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}