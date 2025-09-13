"use client";
import { useState, useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useFirebase } from '@/app/FirebaseProvider';
import { collection, doc, getDocs, query, onSnapshot, orderBy } from 'firebase/firestore';

// --- 型定義 ---
type ViewMode = 'vleague' | 'effectiveness' | 'count';
interface Player { id: string; displayName: string; }
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
  const [viewMode, setViewMode] = useState<ViewMode>('vleague');
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

  const filteredEvents = useMemo(() => {
    if (selectedSetId === 'all') {
      return allEvents;
    }
    return allEvents.filter(event => event.setId === selectedSetId);
  }, [allEvents, selectedSetId]);

  const stats = useMemo(() => {
    const statsMap = new Map<string, Stats>();
    players.forEach(p => { statsMap.set(p.id, { serve_total: 0, serve_point: 0, serve_success: 0, serve_effect: 0, serve_miss: 0, attack_total: 0, attack_point: 0, attack_success: 0, attack_miss: 0, block_total: 0, block_point: 0, block_success: 0, block_miss: 0, reception_total: 0, reception_A: 0, reception_B: 0, reception_C: 0, reception_miss: 0, dig_total: 0, dig_success: 0, dig_miss: 0, toss_miss_total: 0 }); });
    
    for (const event of filteredEvents) {
      if (!event.playerId || !statsMap.has(event.playerId)) continue;
      const playerStats = statsMap.get(event.playerId)!;
      switch (event.action) {
        case "SERVE": case "サーブ":
          playerStats.serve_total++;
          if (event.result === "得点") playerStats.serve_point++;
          if (event.result === "成功") playerStats.serve_success++;
          if (event.result === "効果") playerStats.serve_effect++;
          if (event.result === "失点") playerStats.serve_miss++;
          break;
        case "ATTACK": case "アタック": case "スパイク":
          playerStats.attack_total++; if (event.result === "得点") playerStats.attack_point++; if (event.result === "成功") playerStats.attack_success++; if (event.result === "失点") playerStats.attack_miss++; break;
        case "BLOCK": case "ブロック":
          playerStats.block_total++; if (event.result === "得点") playerStats.block_point++; if (event.result === "成功") playerStats.block_success++; if (event.result === "失点") playerStats.block_miss++; break;
        case "RECEPTION": case "レセプション":
          playerStats.reception_total++; if (event.result === "Aパス") playerStats.reception_A++; if (event.result === "Bパス") playerStats.reception_B++; if (event.result === "Cパス") playerStats.reception_C++; if (event.result === "失点") playerStats.reception_miss++; break;
        case "DIG": case "ディグ":
          playerStats.dig_total++; if (event.result === "成功") playerStats.dig_success++; if (event.result === "失敗") playerStats.dig_miss++; break;
        case "TOSS_MISS": case "トスミス":
          playerStats.toss_miss_total++; break;
      }
    }

    const finalStats: { [id: string]: Stats } = {};
    const totalSetsInFilter = selectedSetId === 'all' ? sets.length : 1;

    statsMap.forEach((s, playerId) => {
        // 全モード共通で計算
        const { serve_total, serve_point, serve_success, serve_effect, serve_miss } = s;
        const { attack_total, attack_point, attack_miss } = s;
        const { block_total, block_point, block_miss } = s;
        const { reception_total, reception_A, reception_B, reception_C, reception_miss } = s;
        const { dig_total, dig_success } = s;

        // 1. 効果率
        s.serve_effectiveness_rate = serve_total > 0 ? ((serve_point * 100 + serve_effect * 50 + serve_success * 25 - serve_miss * 25) / serve_total) : 0;
        s.attack_effectiveness_rate = attack_total > 0 ? ((attack_point - attack_miss) / attack_total) * 100 : 0;
        s.block_effectiveness_rate = block_total > 0 ? ((block_point - block_miss) / block_total) * 100 : 0;
        s.reception_effectiveness_rate = reception_total > 0 ? ((reception_A * 100 + reception_B * 50 + reception_C * 0 - reception_miss * 100) / reception_total) : 0;
        
        // 2. Vリーグ準拠
        s.v_attack_decision_rate = attack_total > 0 ? (attack_point / attack_total) * 100 : 0;
        s.v_block_per_set = totalSetsInFilter > 0 ? (block_point / totalSetsInFilter) : 0;
        s.v_reception_success_rate = reception_total > 0 ? ((reception_A * 100 + reception_B * 50) / reception_total) : 0;

        // 3. その他
        s.dig_success_rate = dig_total > 0 ? (dig_success / dig_total) * 100 : 0;
        s.total_points = s.serve_point + s.attack_point + s.block_point;

        finalStats[playerId] = s;
    });
    return finalStats;
  }, [filteredEvents, players, sets, selectedSetId]);

  const filteredPlayers = useMemo(() => {
    return players.filter(p => stats[p.id] && filteredEvents.some(e => e.playerId === p.id));
  }, [players, stats, filteredEvents]);

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
                <button onClick={() => setViewMode('vleague')} className={`transition-colors duration-200 ease-in-out px-3 py-2 text-sm font-bold rounded-md ${viewMode === 'vleague' ? 'bg-white text-blue-600 shadow' : 'bg-transparent text-gray-500 hover:bg-white/60'}`}>Vリーグ</button>
                <button onClick={() => setViewMode('effectiveness')} className={`transition-colors duration-200 ease-in-out px-3 py-2 text-sm font-bold rounded-md ${viewMode === 'effectiveness' ? 'bg-white text-blue-600 shadow' : 'bg-transparent text-gray-500 hover:bg-white/60'}`}>効果率</button>
                <button onClick={() => setViewMode('count')} className={`transition-colors duration-200 ease-in-out px-3 py-2 text-sm font-bold rounded-md ${viewMode === 'count' ? 'bg-white text-blue-600 shadow' : 'bg-transparent text-gray-500 hover:bg-white/60'}`}>本数</button>
              </div>
              
              <Link href={`/matches/${matchId}`}><span className="px-4 py-2 bg-blue-600 text-white text-base font-bold rounded-md hover:bg-blue-700">記録/編集</span></Link>
              <Link href="/dashboard"><span className="px-4 py-2 bg-gray-600 text-white text-base font-bold rounded-md hover:bg-gray-700">ダッシュボード</span></Link>
            </div>
          </div>
        </header>
        <div className="overflow-x-auto bg-white rounded-lg shadow-md">
          <table className="w-full text-sm text-left text-gray-700">
            <thead className="text-xs text-gray-800 uppercase bg-gray-100">
              <tr>
                <th scope="col" className="px-4 py-3 sticky left-0 bg-gray-100 z-10">選手名</th>
                <th scope="col" className="px-4 py-3 text-center">総得点</th>
                <th scope="col" className="px-4 py-3 text-center">
                  サーブ
                  {viewMode === 'count' && <span className="block font-normal normal-case text-gray-600">(得点/効果/成功/失点 (総数))</span>}
                  {viewMode !== 'count' && <span className="block font-normal normal-case text-gray-600">効果率</span>}
                </th>
                <th scope="col" className="px-4 py-3 text-center">
                  アタック
                  {viewMode === 'vleague' && <span className="block font-normal normal-case text-gray-600">決定率</span>}
                  {viewMode === 'effectiveness' && <span className="block font-normal normal-case text-gray-600">効果率</span>}
                  {viewMode === 'count' && <span className="block font-normal normal-case text-gray-600">(得点/成功/失点 (総数))</span>}
                </th>
                <th scope="col" className="px-4 py-3 text-center">
                  ブロック
                  {viewMode === 'vleague' && <span className="block font-normal normal-case text-gray-600">本数/Set</span>}
                  {viewMode === 'effectiveness' && <span className="block font-normal normal-case text-gray-600">効果率</span>}
                  {viewMode === 'count' && <span className="block font-normal normal-case text-gray-600">(得点/成功/失点 (総数))</span>}
                </th>
                <th scope="col" className="px-4 py-3 text-center">
                  レセプション
                  {viewMode === 'vleague' && <span className="block font-normal normal-case text-gray-600">成功率</span>}
                  {viewMode === 'effectiveness' && <span className="block font-normal normal-case text-gray-600">効果率</span>}
                  {viewMode === 'count' && <span className="block font-normal normal-case text-gray-600">(A/B/C/失点 (総数))</span>}
                </th>
                <th scope="col" className="px-4 py-3 text-center">
                  ディグ
                  {viewMode !== 'count' && <span className="block font-normal normal-case text-gray-600">成功率</span>}
                  {viewMode === 'count' && <span className="block font-normal normal-case text-gray-600">(成功/失敗 (総数))</span>}
                </th>
                <th scope="col" className="px-4 py-3 text-center">
                  トスミス
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredPlayers.map(player => {
                const s = stats[player.id];
                return (
                  <tr key={player.id} className="bg-white border-b hover:bg-gray-50">
                    <th scope="row" className="px-4 py-4 font-bold text-gray-900 sticky left-0 bg-white z-10">{player.displayName}</th>
                    <td className="px-4 py-4 text-center font-bold text-gray-900">{s.total_points}</td>
                    {/* サーブ */}
                    <td className="px-4 py-4 text-center">{viewMode === 'count' ? `${s.serve_point}/${s.serve_effect}/${s.serve_success}/${s.serve_miss} (${s.serve_total})` : `${s.serve_effectiveness_rate.toFixed(1)}%`}</td>
                    {/* アタック */}
                    <td className="px-4 py-4 text-center">
                      {viewMode === 'vleague' && `${s.v_attack_decision_rate.toFixed(1)}%`}
                      {viewMode === 'effectiveness' && `${s.attack_effectiveness_rate.toFixed(1)}%`}
                      {viewMode === 'count' && `${s.attack_point}/${s.attack_success}/${s.attack_miss} (${s.attack_total})`}
                    </td>
                    {/* ブロック */}
                    <td className="px-4 py-4 text-center">
                      {viewMode === 'vleague' && s.v_block_per_set.toFixed(2)}
                      {viewMode === 'effectiveness' && `${s.block_effectiveness_rate.toFixed(1)}%`}
                      {viewMode === 'count' && `${s.block_point}/${s.block_success}/${s.block_miss} (${s.block_total})`}
                    </td>
                    {/* レセプション */}
                    <td className="px-4 py-4 text-center">
                      {viewMode === 'vleague' && `${s.v_reception_success_rate.toFixed(1)}%`}
                      {viewMode === 'effectiveness' && `${s.reception_effectiveness_rate.toFixed(1)}%`}
                      {viewMode === 'count' && `${s.reception_A}/${s.reception_B}/${s.reception_C}/${s.reception_miss} (${s.reception_total})`}
                    </td>
                    {/* ディグ */}
                    <td className="px-4 py-4 text-center">{viewMode === 'count' ? `${s.dig_success}/${s.dig_miss} (${s.dig_total})` : `${s.dig_success_rate.toFixed(1)}%`}</td>
                    {/* トスミス */}
                    <td className="px-4 py-4 text-center">{viewMode === 'count' ? s.toss_miss_total : '-'}</td>
                  </tr>
                );
              })}
              {filteredPlayers.length === 0 && (<tr><td colSpan={8} className="text-center py-8 text-gray-500">記録されたプレーがありません。</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}