"use client";
import { useState, useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useFirebase } from '@/app/FirebaseProvider';
import { collection, doc, getDocs, query, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorDisplay } from '@/components/ErrorDisplay';

// --- 型定義 ---
type ViewMode = 'vleague' | 'effectiveness' | 'count';
interface Player { id: string; displayName: string; }
interface Event { id: string; action: string; result: string; playerId: string; setId: string; }
interface Match { opponent: string; }
interface Set { id: string; setNumber: number; }
interface Stats { [key: string]: number; }
interface TeamInfo { id: string; name: string; }

export default function SummaryPage() {
  const { db } = useFirebase();
  const pathname = usePathname();
  const matchId = pathname.split('/')[2] || '';

  const [teamInfo, setTeamInfo] = useState<TeamInfo | null>(null);
  const teamId = teamInfo?.id;

  const [match, setMatch] = useState<Match | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [sets, setSets] = useState<Set[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('vleague');
  const [selectedSetId, setSelectedSetId] = useState<string>('all');

  useEffect(() => {
    const storedTeam = localStorage.getItem('currentTeam');
    if (storedTeam) {
      setTeamInfo(JSON.parse(storedTeam));
    }
  }, []);

  useEffect(() => {
    if (!db || !matchId || !teamId) return;
    
    setLoading(true);

    const fetchPlayers = async () => {
      try {
        const playersSnap = await getDocs(collection(db, `teams/${teamId}/players`));
        setPlayers(playersSnap.docs.map(d => {
          const data = d.data();
          return { id: d.id, displayName: data.displayName } as Player;
        }));
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '選手データの取得に失敗しました';
        setError(errorMessage);
      }
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
        // 並列処理でイベントを取得（パフォーマンス最適化）
        const eventPromises = setsSnapshot.docs.map(setDoc => 
          getDocs(query(
            collection(setDoc.ref, 'events'),
            orderBy('createdAt', 'asc')
          )).then(eventsSnap => ({
            setId: setDoc.id,
            events: eventsSnap.docs.map(eDoc => ({ id: eDoc.id, ...eDoc.data() }))
          }))
        );
        
        const results = await Promise.all(eventPromises);

        results.forEach(result => {
          result.events.forEach(eventData => {
            const event = eventData as { playerId?: string; action?: string; result?: string };
            if (event.playerId && event.action && event.result) {
              fetchedEvents.push({
                id: eventData.id || '',
                action: event.action,
                result: event.result,
                playerId: event.playerId,
                setId: result.setId
              } as Event);
            }
          });
        });

        setAllEvents(fetchedEvents);
        setError(null);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'データの処理に失敗しました';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    });

    return () => { matchUnsubscribe(); setsUnsubscribe(); };
  }, [db, matchId, teamId]);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" text="集計データを読み込んでいます..." />
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <ErrorDisplay error={error} onRetry={() => window.location.reload()} />
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 py-4">
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                試合結果 vs {match?.opponent || '...'}
              </h1>
              <p className="text-base text-gray-600 mt-1 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                {headerText}
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <select 
                value={selectedSetId} 
                onChange={(e) => setSelectedSetId(e.target.value)}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="all">合計</option>
                {sets.map(set => (
                  <option key={set.id} value={set.id}>Set {set.setNumber}</option>
                ))}
              </select>
              
              <div className="flex items-center p-1 bg-gray-100 rounded-lg border border-gray-200">
                <button onClick={() => setViewMode('vleague')} className={`transition-all px-3 py-2 text-sm font-semibold rounded-md ${viewMode === 'vleague' ? 'bg-white text-indigo-600 shadow-md' : 'bg-transparent text-gray-600 hover:bg-white/60'}`}>Vリーグ</button>
                <button onClick={() => setViewMode('effectiveness')} className={`transition-all px-3 py-2 text-sm font-semibold rounded-md ${viewMode === 'effectiveness' ? 'bg-white text-indigo-600 shadow-md' : 'bg-transparent text-gray-600 hover:bg-white/60'}`}>効果率</button>
                <button onClick={() => setViewMode('count')} className={`transition-all px-3 py-2 text-sm font-semibold rounded-md ${viewMode === 'count' ? 'bg-white text-indigo-600 shadow-md' : 'bg-transparent text-gray-600 hover:bg-white/60'}`}>本数</button>
              </div>
              
              <Link href={`/matches/${matchId}`}>
                <span className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors">
                  記録/編集
                </span>
              </Link>
              <Link href="/dashboard">
                <span className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-200 transition-colors">
                  ダッシュボード
                </span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-700">
              <thead className="text-xs text-gray-800 uppercase bg-gray-50 border-b border-gray-200">
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
                  <tr key={player.id} className="bg-white border-b border-gray-200 hover:bg-gray-50 transition-colors">
                    <th scope="row" className="px-4 py-4 font-bold text-gray-900 sticky left-0 bg-white z-10 border-r border-gray-200">{player.displayName}</th>
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
              {filteredPlayers.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-500">
                    <svg className="w-16 h-16 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <p>記録されたプレーがありません</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </div>
      </main>
    </div>
  );
}