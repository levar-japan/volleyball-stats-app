"use client";
import { useState, useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useFirebase } from '@/app/FirebaseProvider';
import { collection, doc, getDocs, query, onSnapshot, orderBy } from 'firebase/firestore';

// --- 型定義 ---
interface Player { id: string; displayName: string; }
// setId を追加して、どのセットのイベントかを識別できるようにする
interface Event { id: string; action: string; result: string; playerId: string; setId: string; }
interface Match { opponent: string; }
interface Set { id: string; setNumber: number; }
interface Stats { [key: string]: number; }

export default function SummaryPage() {
  const { db, teamInfo } = useFirebase();
  const pathname = usePathname();
  const matchId = pathname.split('/')[2] || '';

  const [match, setMatch] = useState<Match | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [sets, setSets] = useState<Set[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'rate' | 'count'>('rate');
  // 選択されたセットIDを管理するState。'all' は合計を示す
  const [selectedSetId, setSelectedSetId] = useState<string>('all');

  useEffect(() => {
    if (!db || !matchId || !teamInfo?.id) return;
    const teamId = teamInfo.id;
    setLoading(true);

    const fetchPlayers = async () => {
      try {
        const playersSnap = await getDocs(collection(db, `teams/${teamId}/players`));
        setPlayers(playersSnap.docs.map(d => ({ ...d.data(), id: d.id } as Player)));
      } catch (err) { console.error("Failed to fetch players:", err); setError("選手データの取得に失敗しました。"); }
    };
    fetchPlayers();
    
    const matchUnsubscribe = onSnapshot(doc(db, `teams/${teamId}/matches/${matchId}`), (docSnap) => { if (docSnap.exists()) { setMatch(docSnap.data() as Match); } });
    
    const setsRef = collection(db, `teams/${teamId}/matches/${matchId}/sets`);
    const q = query(setsRef, orderBy('setNumber', 'asc'));

    const setsUnsubscribe = onSnapshot(q, async (setsSnapshot) => {
      try {
        const setsData = setsSnapshot.docs.map(d => ({ id: d.id, setNumber: d.data().setNumber } as Set));
        setSets(setsData);
        
        const fetchedEvents: Event[] = [];
        const eventPromises = setsSnapshot.docs.map(setDoc => 
          getDocs(collection(setDoc.ref, 'events')).then(eventsSnap => ({
            setId: setDoc.id,
            events: eventsSnap.docs.map(eDoc => ({ id: eDoc.id, ...eDoc.data() }))
          }))
        );
        
        const results = await Promise.all(eventPromises);

        results.forEach(result => {
          result.events.forEach(eventData => {
            // 【修正点】型アサーションを追加して 'playerId' プロパティへのアクセスを許可する
            if ((eventData as { playerId?: string }).playerId) {
              fetchedEvents.push({ ...eventData, setId: result.setId } as Event);
            }
          });
        });

        setAllEvents(fetchedEvents);
        setError(null);
      } catch (err) { console.error("Failed to process sets/events:", err); setError((err as Error).message); } 
      finally { setLoading(false); }
    });

    return () => { matchUnsubscribe(); setsUnsubscribe(); };
  }, [db, matchId, teamInfo]);

  // 選択されたセットに応じて表示するイベントをフィルタリング
  const filteredEvents = useMemo(() => {
    if (selectedSetId === 'all') {
      return allEvents;
    }
    return allEvents.filter(event => event.setId === selectedSetId);
  }, [allEvents, selectedSetId]);

  const stats = useMemo(() => {
    const statsMap = new Map<string, Stats>();
    players.forEach(p => { statsMap.set(p.id, { serve_total: 0, serve_point: 0, serve_success: 0, serve_miss: 0, spike_total: 0, spike_point: 0, spike_success: 0, spike_miss: 0, block_total: 0, block_point: 0, block_success: 0, block_miss: 0, reception_total: 0, reception_A: 0, reception_B: 0, reception_C: 0, reception_miss: 0, dig_total: 0, dig_success: 0, dig_miss: 0, }); });
    
    // allEvents の代わりに filteredEvents を使用
    for (const event of filteredEvents) {
      if (!event.playerId || !statsMap.has(event.playerId)) continue;
      const playerStats = statsMap.get(event.playerId)!;
      switch (event.action) {
        case "サーブ": playerStats.serve_total++; if (event.result === "得点") playerStats.serve_point++; if (event.result === "成功") playerStats.serve_success++; if (event.result === "失点") playerStats.serve_miss++; break;
        case "スパイク": playerStats.spike_total++; if (event.result === "得点") playerStats.spike_point++; if (event.result === "成功") playerStats.spike_success++; if (event.result === "失点") playerStats.spike_miss++; break;
        case "ブロック": playerStats.block_total++; if (event.result === "得点") playerStats.block_point++; if (event.result === "成功") playerStats.block_success++; if (event.result === "失点") playerStats.block_miss++; break;
        case "レセプション": playerStats.reception_total++; if (event.result === "Aパス") playerStats.reception_A++; if (event.result === "Bパス") playerStats.reception_B++; if (event.result === "Cパス") playerStats.reception_C++; if (event.result === "失点") playerStats.reception_miss++; break;
        case "ディグ": playerStats.dig_total++; if (event.result === "成功") playerStats.dig_success++; if (event.result === "失敗") playerStats.dig_miss++; break;
      }
    }

    const finalStats: { [id: string]: Stats } = {};
    statsMap.forEach((s, playerId) => {
        const { serve_total, serve_point, serve_success, serve_miss } = s; 
        s.serve_success_rate = serve_total > 0 ? ((serve_point * 100 + serve_success * 25 - serve_miss * 25) / serve_total) : 0;
        const { spike_total, spike_point } = s; s.spike_success_rate = spike_total > 0 ? (spike_point / spike_total) * 100 : 0;
        const { block_total, block_point } = s; s.block_success_rate = block_total > 0 ? (block_point / block_total) * 100 : 0;
        const { reception_total, reception_A, reception_B } = s; s.reception_success_rate = reception_total > 0 ? ((reception_A * 100 + reception_B * 50) / reception_total) : 0;
        const { dig_total, dig_success } = s; s.dig_success_rate = dig_total > 0 ? (dig_success / dig_total) * 100 : 0;
        finalStats[playerId] = s;
    });
    return finalStats;
  }, [filteredEvents, players]);

  const filteredPlayers = useMemo(() => {
    // filteredEvents を使って、選択されたセットでプレーした選手のみをフィルタリング
    return players.filter(p => stats[p.id] && filteredEvents.some(e => e.playerId === p.id));
  }, [players, stats, filteredEvents]);

  // ヘッダーに表示するテキストを動的に生成
  const headerText = useMemo(() => {
    if (selectedSetId === 'all') {
      return `${sets.length} セットの合計スタッツ`;
    }
    const selected = sets.find(s => s.id === selectedSetId);
    return selected ? `Set ${selected.setNumber} のスタッツ` : 'スタッツ';
  }, [selectedSetId, sets]);

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-gray-100"><p>集計データを読み込んでいます...</p></main>;
  if (error) return <main className="flex min-h-screen items-center justify-center bg-gray-100"><p className="text-red-500 max-w-md text-center">エラー: {error}</p></main>;
  
  return (
    <main className="min-h-screen bg-gray-100 p-4 sm:p-8">
      <div className="w-full max-w-7xl mx-auto">
        <header className="bg-white p-4 rounded-lg shadow-md mb-6">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">試合結果 vs {match?.opponent || '...'}</h1>
              <p className="text-base text-gray-700 mt-1">{headerText}</p>
            </div>
            <div className="flex items-center gap-3 mt-4 sm:mt-0">
              <select 
                value={selectedSetId} 
                onChange={(e) => setSelectedSetId(e.target.value)}
                className="bg-gray-200 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
              >
                <option value="all">合計</option>
                {sets.map(set => (
                  <option key={set.id} value={set.id}>Set {set.setNumber}</option>
                ))}
              </select>
              
              <div className="flex items-center p-1 bg-gray-200 rounded-lg">
                <button onClick={() => setViewMode('rate')} className={`px-4 py-2 text-sm font-bold rounded-md ${viewMode === 'rate' ? 'bg-white shadow' : ''}`}>率で表示</button>
                <button onClick={() => setViewMode('count')} className={`px-4 py-2 text-sm font-bold rounded-md ${viewMode === 'count' ? 'bg-white shadow' : ''}`}>数で表示</button>
              </div>
              <Link href={`/matches/${matchId}`}><span className="px-4 py-2 bg-blue-600 text-white text-base font-bold rounded-md hover:bg-blue-700">記録/編集</span></Link>
            </div>
          </div>
        </header>
        <div className="overflow-x-auto bg-white rounded-lg shadow-md">
          <table className="w-full text-sm text-left text-gray-700">
            <thead className="text-xs text-gray-800 uppercase bg-gray-100"><tr><th scope="col" className="px-4 py-3 sticky left-0 bg-gray-100 z-10">選手名</th><th scope="col" className="px-4 py-3 text-center">サーブ効果率</th><th scope="col" className="px-4 py-3 text-center">アタック決定率</th><th scope="col" className="px-4 py-3 text-center">ブロック決定率</th><th scope="col" className="px-4 py-3 text-center">レセプション成功率</th><th scope="col" className="px-4 py-3 text-center">ディグ成功率</th></tr></thead>
            <tbody>
              {filteredPlayers.length > 0 ? filteredPlayers.map(player => { const s = stats[player.id]; return (<tr key={player.id} className="bg-white border-b hover:bg-gray-50"><th scope="row" className="px-4 py-4 font-bold text-gray-900 sticky left-0 bg-white z-10">{player.displayName}</th><td className="px-4 py-4 text-center">{viewMode === 'rate' ? `${s.serve_success_rate.toFixed(1)}%` : `${s.serve_point}/${s.serve_success}/${s.serve_miss} (${s.serve_total})`}</td><td className="px-4 py-4 text-center">{viewMode === 'rate' ? `${s.spike_success_rate.toFixed(1)}%` : `${s.spike_point}/${s.spike_success}/${s.spike_miss} (${s.spike_total})`}</td><td className="px-4 py-4 text-center">{viewMode === 'rate' ? `${s.block_success_rate.toFixed(1)}%` : `${s.block_point}/${s.block_success}/${s.block_miss} (${s.block_total})`}</td><td className="px-4 py-4 text-center">{viewMode === 'rate' ? `${s.reception_success_rate.toFixed(1)}%` : `${s.reception_A}/${s.reception_B}/${s.reception_C} (${s.reception_total})`}</td><td className="px-4 py-4 text-center">{viewMode === 'rate' ? `${s.dig_success_rate.toFixed(1)}%` : `${s.dig_success}/${s.dig_miss} (${s.dig_total})`}</td></tr>); }) : (<tr><td colSpan={6} className="text-center py-8 text-gray-500">記録されたプレーがありません。</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}