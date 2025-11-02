"use client";
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useFirebase } from '@/app/FirebaseProvider';
import { useRouter } from 'next/navigation';
import { collection, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';
import Link from 'next/link';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface TeamInfo { id: string; name: string; }
interface Player { id: string; displayName: string; }
interface Match {
  id: string;
  opponent: string;
  matchDate: Timestamp;
  seasonId?: string;
  status: string;
}
interface Set {
  id: string;
  matchId: string;
  setNumber: number;
  ourScore: number;
  opponentScore: number;
  status: string;
}
interface Event {
  id: string;
  playerId: string | null;
  playerName: string;
  action: string;
  result: string;
  createdAt: Timestamp;
  matchId?: string;
  setId?: string;
}

interface Season {
  id: string;
  name: string;
  startDate: Timestamp;
  endDate: Timestamp;
}

type ViewMode = 'player' | 'team' | 'sets' | 'weakness' | 'overview';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function AnalyticsPage() {
  const { db } = useFirebase();
  const router = useRouter();
  const [teamInfo, setTeamInfo] = useState<TeamInfo | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [sets, setSets] = useState<Set[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('all');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storedTeam = localStorage.getItem('currentTeam');
    if (storedTeam) {
      setTeamInfo(JSON.parse(storedTeam));
    } else {
      router.push('/dashboard');
    }
  }, [router]);

  const fetchAllData = useCallback(async () => {
    if (!db || !teamInfo?.id) return;
    setLoading(true);
    try {
      // シーズン取得
      const seasonsSnap = await getDocs(query(collection(db, `teams/${teamInfo.id}/seasons`), orderBy('startDate', 'desc')));
      const seasonsData = seasonsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Season));
      setSeasons(seasonsData);

      // 選手取得
      const playersSnap = await getDocs(collection(db, `teams/${teamInfo.id}/players`));
      setPlayers(playersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player)));

      // 試合取得
      let matchesQuery = query(collection(db, `teams/${teamInfo.id}/matches`), orderBy('matchDate', 'desc'));
      if (selectedSeasonId !== 'all') {
        matchesQuery = query(collection(db, `teams/${teamInfo.id}/matches`), where('seasonId', '==', selectedSeasonId), orderBy('matchDate', 'desc'));
      }
      const matchesSnap = await getDocs(matchesQuery);
      const matchesData = matchesSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Match));
      setMatches(matchesData);

      // セットとイベント取得
      const allSets: Set[] = [];
      const allEvents: Event[] = [];
      
      for (const match of matchesData) {
        const setsSnap = await getDocs(query(collection(db, `teams/${teamInfo.id}/matches/${match.id}/sets`), orderBy('setNumber', 'asc')));
        const setsData = setsSnap.docs.map(doc => ({
          id: doc.id,
          matchId: match.id,
          ...doc.data()
        } as Set));
        allSets.push(...setsData);

        for (const set of setsData) {
          const eventsSnap = await getDocs(query(collection(db, `teams/${teamInfo.id}/matches/${match.id}/sets/${set.id}/events`), orderBy('createdAt', 'asc')));
          const eventsData = eventsSnap.docs.map(doc => ({
            id: doc.id,
            matchId: match.id,
            setId: set.id,
            ...doc.data()
          } as Event & { matchId: string; setId: string }));
          allEvents.push(...eventsData);
        }
      }
      
      setSets(allSets);
      setEvents(allEvents);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("データの取得に失敗しました。");
    } finally {
      setLoading(false);
    }
  }, [db, teamInfo?.id, selectedSeasonId]);

  useEffect(() => {
    if (!db || !teamInfo?.id) return;
    fetchAllData();
  }, [db, teamInfo?.id, fetchAllData]);

  // 選手別パフォーマンス推移データ
  const playerPerformanceData = useMemo(() => {
    const filteredEvents = selectedPlayerId !== 'all' 
      ? events.filter(e => e.playerId === selectedPlayerId)
      : events;

    const result: Array<{
      match: string;
      date: string;
      [key: string]: string | number;
    }> = [];

    matches.forEach(match => {
      const matchEvents = filteredEvents.filter(e => e.matchId === match.id);
      
      const matchStats: { [key: string]: number } = {
        attackPoint: 0,
        attackMiss: 0,
        servePoint: 0,
        serveMiss: 0,
        blockPoint: 0,
        receptionMiss: 0,
      };

      matchEvents.forEach(event => {
        if (event.action === 'ATTACK' && event.result === '得点') matchStats.attackPoint++;
        if (event.action === 'ATTACK' && event.result === '失点') matchStats.attackMiss++;
        if (event.action === 'SERVE' && event.result === '得点') matchStats.servePoint++;
        if (event.action === 'SERVE' && event.result === '失点') matchStats.serveMiss++;
        if (event.action === 'BLOCK' && event.result === '得点') matchStats.blockPoint++;
        if (event.action === 'RECEPTION' && event.result === '失点') matchStats.receptionMiss++;
      });

      // attackMiss, serveMiss, receptionMiss はグラフで使用されるため保持

      result.push({
        match: match.opponent,
        date: match.matchDate.toDate().toLocaleDateString(),
        attackPoint: matchStats.attackPoint,
        attackMiss: matchStats.attackMiss,
        servePoint: matchStats.servePoint,
        serveMiss: matchStats.serveMiss,
        blockPoint: matchStats.blockPoint,
        receptionMiss: matchStats.receptionMiss,
      });
    });

    return result;
  }, [events, matches, selectedPlayerId]);

  // セットごとのスコア推移
  const setScoreData = useMemo(() => {
    const result: Array<{
      matchSet: string;
      ourScore: number;
      opponentScore: number;
    }> = [];

    matches.forEach(match => {
      const matchSets = sets.filter(s => s.matchId === match.id).sort((a, b) => a.setNumber - b.setNumber);
      matchSets.forEach(set => {
        result.push({
          matchSet: `${match.opponent} Set${set.setNumber}`,
          ourScore: set.ourScore,
          opponentScore: set.opponentScore,
        });
      });
    });

    return result;
  }, [matches, sets]);

  // チーム全体パフォーマンス推移
  const teamPerformanceData = useMemo(() => {
    const result: Array<{
      match: string;
      date: string;
      totalPoints: number;
      totalErrors: number;
      attackSuccessRate: number;
      serveSuccessRate: number;
      receptionSuccessRate: number;
    }> = [];

    matches.forEach(match => {
      const matchEvents = events.filter(e => e.matchId === match.id);

      let attackTotal = 0, attackPoint = 0;
      let serveTotal = 0, servePoint = 0;
      let receptionTotal = 0, receptionA = 0, receptionB = 0;
      let totalErrors = 0;

      matchEvents.forEach(event => {
        if (event.action === 'ATTACK') {
          attackTotal++;
          if (event.result === '得点') attackPoint++;
          if (event.result === '失点') totalErrors++;
        }
        if (event.action === 'SERVE') {
          serveTotal++;
          if (event.result === '得点') servePoint++;
          if (event.result === '失点') totalErrors++;
        }
        if (event.action === 'RECEPTION') {
          receptionTotal++;
          if (event.result === 'Aパス') receptionA++;
          if (event.result === 'Bパス') receptionB++;
          if (event.result === '失点') totalErrors++;
        }
        if (event.action === 'OUR_ERROR') totalErrors++;
      });

      result.push({
        match: match.opponent,
        date: match.matchDate.toDate().toLocaleDateString(),
        totalPoints: attackPoint + servePoint,
        totalErrors,
        attackSuccessRate: attackTotal > 0 ? (attackPoint / attackTotal) * 100 : 0,
        serveSuccessRate: serveTotal > 0 ? (servePoint / serveTotal) * 100 : 0,
        receptionSuccessRate: receptionTotal > 0 ? ((receptionA + receptionB) / receptionTotal) * 100 : 0,
      });
    });

    return result;
  }, [events, matches]);

  // 弱点分析
  const weaknessData = useMemo(() => {
    const weaknessMap = new Map<string, number>();
    
    events.forEach(event => {
      if (event.result === '失点' || event.result === '失敗' || event.action === 'OUR_ERROR') {
        const key = `${event.action}_${event.result}`;
        weaknessMap.set(key, (weaknessMap.get(key) || 0) + 1);
      }
    });

    const result = Array.from(weaknessMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    return result;
  }, [events]);

  // チーム全体統計
  const teamOverallStats = useMemo(() => {
    let attackTotal = 0, attackPoint = 0, attackMiss = 0;
    let serveTotal = 0, servePoint = 0, serveMiss = 0;
    let blockTotal = 0, blockPoint = 0, blockMiss = 0;
    let receptionTotal = 0, receptionA = 0, receptionB = 0, receptionC = 0, receptionMiss = 0;
    let digTotal = 0, digSuccess = 0, digMiss = 0;
    let totalErrors = 0;

    events.forEach(event => {
      if (event.action === 'ATTACK') {
        attackTotal++;
        if (event.result === '得点') attackPoint++;
        if (event.result === '失点') { attackMiss++; totalErrors++; }
      }
      if (event.action === 'SERVE') {
        serveTotal++;
        if (event.result === '得点') servePoint++;
        if (event.result === '失点') { serveMiss++; totalErrors++; }
      }
      if (event.action === 'BLOCK') {
        blockTotal++;
        if (event.result === '得点') blockPoint++;
        if (event.result === '失点') { blockMiss++; totalErrors++; }
      }
      if (event.action === 'RECEPTION') {
        receptionTotal++;
        if (event.result === 'Aパス') receptionA++;
        if (event.result === 'Bパス') receptionB++;
        if (event.result === 'Cパス') receptionC++;
        if (event.result === '失点') { receptionMiss++; totalErrors++; }
      }
      if (event.action === 'DIG') {
        digTotal++;
        if (event.result === '成功') digSuccess++;
        if (event.result === '失敗') { digMiss++; totalErrors++; }
      }
      if (event.action === 'OUR_ERROR') totalErrors++;
    });

    return {
      attack: {
        total: attackTotal,
        point: attackPoint,
        miss: attackMiss,
        successRate: attackTotal > 0 ? (attackPoint / attackTotal) * 100 : 0,
      },
      serve: {
        total: serveTotal,
        point: servePoint,
        miss: serveMiss,
        successRate: serveTotal > 0 ? (servePoint / serveTotal) * 100 : 0,
      },
      block: {
        total: blockTotal,
        point: blockPoint,
        miss: blockMiss,
        successRate: blockTotal > 0 ? (blockPoint / blockTotal) * 100 : 0,
      },
      reception: {
        total: receptionTotal,
        a: receptionA,
        b: receptionB,
        c: receptionC,
        miss: receptionMiss,
        successRate: receptionTotal > 0 ? ((receptionA + receptionB) / receptionTotal) * 100 : 0,
      },
      dig: {
        total: digTotal,
        success: digSuccess,
        miss: digMiss,
        successRate: digTotal > 0 ? (digSuccess / digTotal) * 100 : 0,
      },
      totalErrors,
      totalPoints: attackPoint + servePoint + blockPoint,
    };
  }, [events]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center animate-pulse">
            <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="text-gray-600 font-medium">読み込んでいます...</p>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 flex items-center justify-center">
        <div className="bg-white p-6 rounded-xl shadow-lg border border-red-200 max-w-md">
          <p className="text-red-700 font-medium">{error}</p>
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
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              統計分析
            </h1>
            <div className="flex items-center gap-3">
              <select
                value={selectedSeasonId}
                onChange={(e) => setSelectedSeasonId(e.target.value)}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="all">全シーズン</option>
                {seasons.map(season => (
                  <option key={season.id} value={season.id}>{season.name}</option>
                ))}
              </select>
              <Link href="/dashboard">
                <span className="px-4 py-2 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors">
                  ダッシュボード
                </span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* タブ切り替え */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-2 mb-6">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setViewMode('overview')}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${viewMode === 'overview' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              概要
            </button>
            <button
              onClick={() => setViewMode('player')}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${viewMode === 'player' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              選手別推移
            </button>
            <button
              onClick={() => setViewMode('sets')}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${viewMode === 'sets' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              セットスコア
            </button>
            <button
              onClick={() => setViewMode('team')}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${viewMode === 'team' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              チーム推移
            </button>
            <button
              onClick={() => setViewMode('weakness')}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${viewMode === 'weakness' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              弱点分析
            </button>
          </div>
        </div>

        {/* 概要ビュー */}
        {viewMode === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">総得点</h3>
              <p className="text-4xl font-bold bg-gradient-to-br from-indigo-600 to-blue-600 bg-clip-text text-transparent">{teamOverallStats.totalPoints}</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">総失点</h3>
              <p className="text-4xl font-bold bg-gradient-to-br from-red-500 to-red-600 bg-clip-text text-transparent">{teamOverallStats.totalErrors}</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">試合数</h3>
              <p className="text-4xl font-bold text-gray-700">{matches.length}</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">アタック成功率</h3>
              <p className="text-4xl font-bold bg-gradient-to-br from-green-500 to-emerald-600 bg-clip-text text-transparent">{teamOverallStats.attack.successRate.toFixed(1)}%</p>
              <p className="text-sm text-gray-600 mt-2">{teamOverallStats.attack.point}/{teamOverallStats.attack.total}</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">サーブ成功率</h3>
              <p className="text-4xl font-bold bg-gradient-to-br from-green-500 to-emerald-600 bg-clip-text text-transparent">{teamOverallStats.serve.successRate.toFixed(1)}%</p>
              <p className="text-sm text-gray-600 mt-2">{teamOverallStats.serve.point}/{teamOverallStats.serve.total}</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">レセプション成功率</h3>
              <p className="text-4xl font-bold bg-gradient-to-br from-green-500 to-emerald-600 bg-clip-text text-transparent">{teamOverallStats.reception.successRate.toFixed(1)}%</p>
              <p className="text-sm text-gray-600 mt-2">A+B: {teamOverallStats.reception.a + teamOverallStats.reception.b}/{teamOverallStats.reception.total}</p>
            </div>
          </div>
        )}

        {/* 選手別パフォーマンス推移 */}
        {viewMode === 'player' && (
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">選手選択</label>
              <select
                value={selectedPlayerId}
                onChange={(e) => setSelectedPlayerId(e.target.value)}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="all">全選手</option>
                {players.map(player => (
                  <option key={player.id} value={player.id}>{player.displayName}</option>
                ))}
              </select>
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-4">選手別パフォーマンス推移</h3>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={playerPerformanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="match" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="attackPoint" stroke="#10b981" name="アタック得点" />
                  <Line type="monotone" dataKey="servePoint" stroke="#3b82f6" name="サーブ得点" />
                  <Line type="monotone" dataKey="blockPoint" stroke="#f59e0b" name="ブロック得点" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-4">失点推移</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={playerPerformanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="match" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="attackMiss" stroke="#ef4444" name="アタック失点" />
                  <Line type="monotone" dataKey="serveMiss" stroke="#f97316" name="サーブ失点" />
                  <Line type="monotone" dataKey="receptionMiss" stroke="#dc2626" name="レセプション失点" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* セットごとのスコア推移 */}
        {viewMode === 'sets' && (
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
            <h3 className="text-xl font-semibold mb-4">セットごとのスコア推移</h3>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={setScoreData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="matchSet" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="ourScore" fill="#3b82f6" name="自チーム" />
                <Bar dataKey="opponentScore" fill="#ef4444" name="相手チーム" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* チーム全体パフォーマンス推移 */}
        {viewMode === 'team' && (
          <div className="bg-white p-6 rounded-lg shadow-md space-y-6">
            <div>
              <h3 className="text-xl font-semibold mb-4">チーム全体パフォーマンス推移</h3>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={teamPerformanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="match" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="totalPoints" stroke="#10b981" name="総得点" />
                  <Line type="monotone" dataKey="totalErrors" stroke="#ef4444" name="総失点" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-4">成功率推移</h3>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={teamPerformanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="match" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="attackSuccessRate" stroke="#3b82f6" name="アタック成功率(%)" />
                  <Line type="monotone" dataKey="serveSuccessRate" stroke="#10b981" name="サーブ成功率(%)" />
                  <Line type="monotone" dataKey="receptionSuccessRate" stroke="#f59e0b" name="レセプション成功率(%)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* 弱点分析 */}
        {viewMode === 'weakness' && (
          <div className="bg-white p-6 rounded-lg shadow-md space-y-6">
            <div>
              <h3 className="text-xl font-semibold mb-4">弱点分析（失点が多い順）</h3>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={weaknessData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={150} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-4">失点分布</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={weaknessData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry: { name?: string; percent?: number }) => 
                      `${entry.name || ''}: ${((entry.percent || 0) * 100).toFixed(0)}%`
                    }
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {weaknessData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

