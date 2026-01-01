"use client";
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useFirebase } from '@/app/FirebaseProvider';
import { useRouter } from 'next/navigation';
import { collection, getDocs, query, where, orderBy, limit, Timestamp } from 'firebase/firestore';
import Link from 'next/link';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import { useGlobalContext } from '@/components/GlobalProviders';
import { useRetry } from '@/hooks/useRetry';
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

type ViewMode = 'overall' | 'player' | 'match';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function AnalyticsPage() {
  const { db, loading: firebaseLoading } = useFirebase();
  const { toast } = useGlobalContext();
  const router = useRouter();
  const [teamInfo, setTeamInfo] = useState<TeamInfo | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [sets, setSets] = useState<Set[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('all');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('all');
  const [selectedMatchId, setSelectedMatchId] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('overall');
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

  // Firebaseが初期化されていない場合の処理
  useEffect(() => {
    if (!firebaseLoading && !db) {
      setLoading(false);
      setError('Firebaseが初期化されていません。環境変数を確認してください。');
    }
  }, [firebaseLoading, db]);

  const fetchAllDataBase = useCallback(async () => {
    if (!db || !teamInfo?.id) return;
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

    // 試合取得（最新100件に制限）
    let matchesQuery = query(
      collection(db, `teams/${teamInfo.id}/matches`), 
      orderBy('matchDate', 'desc'),
      limit(100)
    );
    if (selectedSeasonId !== 'all') {
      matchesQuery = query(
        collection(db, `teams/${teamInfo.id}/matches`), 
        where('seasonId', '==', selectedSeasonId), 
        orderBy('matchDate', 'desc'),
        limit(100)
      );
    }
    const matchesSnap = await getDocs(matchesQuery);
    const matchesData = matchesSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Match));
    setMatches(matchesData);

    // セットとイベント取得（並列処理で最適化）
    const allSets: Set[] = [];
    const allEvents: Event[] = [];
    
    // 並列でセットを取得
    const setsPromises = matchesData.map(match =>
      getDocs(query(collection(db, `teams/${teamInfo.id}/matches/${match.id}/sets`), orderBy('setNumber', 'asc')))
        .then(setsSnap => ({
          matchId: match.id,
          sets: setsSnap.docs.map(doc => ({
            id: doc.id,
            matchId: match.id,
            ...doc.data()
          } as Set))
        }))
    );
    
    const setsResults = await Promise.all(setsPromises);
    setsResults.forEach(result => {
      allSets.push(...result.sets);
    });

    // 並列でイベントを取得（各セットごと）
    const eventsPromises = setsResults.flatMap(result =>
      result.sets.map(set =>
        getDocs(query(
          collection(db, `teams/${teamInfo.id}/matches/${result.matchId}/sets/${set.id}/events`), 
          orderBy('createdAt', 'asc')
        )).then(eventsSnap => ({
          matchId: result.matchId,
          setId: set.id,
          events: eventsSnap.docs.map(doc => ({
            id: doc.id,
            matchId: result.matchId,
            setId: set.id,
            ...doc.data()
          } as Event & { matchId: string; setId: string }))
        }))
      )
    );
    
    const eventsResults = await Promise.all(eventsPromises);
    eventsResults.forEach(result => {
      allEvents.push(...result.events);
    });
    
    setSets(allSets);
    setEvents(allEvents);
    setError(null);
  }, [db, teamInfo?.id, selectedSeasonId]);

  // リトライ機能付きのデータ取得
  const { executeWithRetry } = useRetry(fetchAllDataBase, {
    maxRetries: 3,
    retryDelay: 1000,
    onRetry: (attempt: number) => {
      toast.info(`データ取得を再試行中... (${attempt}/${3})`);
    },
    onMaxRetriesReached: () => {
      toast.error('データの取得に失敗しました。しばらく待ってから再試行してください。');
    },
  });

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      await executeWithRetry();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'データの取得に失敗しました';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [executeWithRetry]);

  useEffect(() => {
    if (!db || !teamInfo?.id || firebaseLoading) return;
    fetchAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, teamInfo?.id, selectedSeasonId]);

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
      totalMatches: matches.length,
      totalSets: sets.length,
      wonSets: sets.filter(s => s.ourScore > s.opponentScore).length,
      lostSets: sets.filter(s => s.ourScore < s.opponentScore).length,
      setWinRate: sets.length > 0 ? (sets.filter(s => s.ourScore > s.opponentScore).length / sets.length) * 100 : 0,
      avgPointsPerMatch: matches.length > 0 ? (attackPoint + servePoint + blockPoint) / matches.length : 0,
      avgErrorsPerMatch: matches.length > 0 ? totalErrors / matches.length : 0,
    };
  }, [events, matches, sets]);

  // 選手別統計
  const playerStats = useMemo(() => {
    const statsMap = new Map<string, {
      playerId: string;
      playerName: string;
      matches: number;
      totalPoints: number;
      totalErrors: number;
      attack: { total: number; point: number; miss: number; successRate: number };
      serve: { total: number; point: number; miss: number; successRate: number };
      block: { total: number; point: number; miss: number; successRate: number };
      reception: { total: number; a: number; b: number; c: number; miss: number; successRate: number };
      dig: { total: number; success: number; miss: number; successRate: number };
    }>();

    players.forEach(player => {
      const playerEvents = events.filter(e => e.playerId === player.id);
      const playerMatches = new Set(playerEvents.map(e => e.matchId).filter(Boolean));
      
      let attackTotal = 0, attackPoint = 0, attackMiss = 0;
      let serveTotal = 0, servePoint = 0, serveMiss = 0;
      let blockTotal = 0, blockPoint = 0, blockMiss = 0;
      let receptionTotal = 0, receptionA = 0, receptionB = 0, receptionC = 0, receptionMiss = 0;
      let digTotal = 0, digSuccess = 0, digMiss = 0;
      let totalErrors = 0;

      playerEvents.forEach(event => {
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

      statsMap.set(player.id, {
        playerId: player.id,
        playerName: player.displayName,
        matches: playerMatches.size,
        totalPoints: attackPoint + servePoint + blockPoint,
        totalErrors,
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
      });
    });

    return Array.from(statsMap.values()).sort((a, b) => b.totalPoints - a.totalPoints);
  }, [events, players]);

  // 試合別統計
  const matchStats = useMemo(() => {
    return matches.map(match => {
      const matchEvents = events.filter(e => e.matchId === match.id);
      const matchSets = sets.filter(s => s.matchId === match.id);
      
      let attackTotal = 0, attackPoint = 0, attackMiss = 0;
      let serveTotal = 0, servePoint = 0, serveMiss = 0;
      let blockTotal = 0, blockPoint = 0, blockMiss = 0;
      let receptionTotal = 0, receptionA = 0, receptionB = 0, receptionC = 0, receptionMiss = 0;
      let digTotal = 0, digSuccess = 0, digMiss = 0;
      let totalErrors = 0;

      matchEvents.forEach(event => {
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

      const wonSets = matchSets.filter(s => s.ourScore > s.opponentScore).length;
      const lostSets = matchSets.filter(s => s.ourScore < s.opponentScore).length;
      const totalOurScore = matchSets.reduce((sum, s) => sum + s.ourScore, 0);
      const totalOpponentScore = matchSets.reduce((sum, s) => sum + s.opponentScore, 0);

      return {
        matchId: match.id,
        opponent: match.opponent,
        date: match.matchDate.toDate().toLocaleDateString(),
        status: match.status,
        sets: matchSets.length,
        wonSets,
        lostSets,
        totalOurScore,
        totalOpponentScore,
        totalPoints: attackPoint + servePoint + blockPoint,
        totalErrors,
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
        setScores: matchSets.map(s => ({
          setNumber: s.setNumber,
          ourScore: s.ourScore,
          opponentScore: s.opponentScore,
        })),
      };
    });
  }, [events, matches, sets]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" text="読み込んでいます..." />
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <ErrorDisplay error={error} onRetry={() => fetchAllData()} />
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
              onClick={() => setViewMode('overall')}
              className={`px-6 py-3 rounded-lg font-semibold text-base transition-all ${viewMode === 'overall' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              全体統計
            </button>
            <button
              onClick={() => setViewMode('player')}
              className={`px-6 py-3 rounded-lg font-semibold text-base transition-all ${viewMode === 'player' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              選手別統計
            </button>
            <button
              onClick={() => setViewMode('match')}
              className={`px-6 py-3 rounded-lg font-semibold text-base transition-all ${viewMode === 'match' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              試合別統計
            </button>
          </div>
        </div>

        {/* 全体統計ビュー */}
        {viewMode === 'overall' && (
          <div className="space-y-6">
            {/* 基本統計 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
                <h3 className="text-lg font-semibold mb-4 text-gray-900">試合数</h3>
                <p className="text-4xl font-bold text-gray-700">{teamOverallStats.totalMatches}</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
                <h3 className="text-lg font-semibold mb-4 text-gray-900">総得点</h3>
                <p className="text-4xl font-bold bg-gradient-to-br from-indigo-600 to-blue-600 bg-clip-text text-transparent">{teamOverallStats.totalPoints}</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
                <h3 className="text-lg font-semibold mb-4 text-gray-900">総失点</h3>
                <p className="text-4xl font-bold bg-gradient-to-br from-red-500 to-red-600 bg-clip-text text-transparent">{teamOverallStats.totalErrors}</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
                <h3 className="text-lg font-semibold mb-4 text-gray-900">セット勝率</h3>
                <p className="text-4xl font-bold bg-gradient-to-br from-green-500 to-emerald-600 bg-clip-text text-transparent">{teamOverallStats.setWinRate.toFixed(1)}%</p>
                <p className="text-sm text-gray-600 mt-2">{teamOverallStats.wonSets}勝{teamOverallStats.lostSets}敗</p>
              </div>
            </div>

            {/* スキル別統計 */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
              <h3 className="text-xl font-semibold mb-6 text-gray-900">スキル別統計</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">アタック</h4>
                  <p className="text-3xl font-bold text-indigo-600">{teamOverallStats.attack.successRate.toFixed(1)}%</p>
                  <p className="text-sm text-gray-600 mt-1">{teamOverallStats.attack.point}得点 / {teamOverallStats.attack.total}回</p>
                  <p className="text-xs text-red-600 mt-1">{teamOverallStats.attack.miss}失点</p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">サーブ</h4>
                  <p className="text-3xl font-bold text-green-600">{teamOverallStats.serve.successRate.toFixed(1)}%</p>
                  <p className="text-sm text-gray-600 mt-1">{teamOverallStats.serve.point}得点 / {teamOverallStats.serve.total}回</p>
                  <p className="text-xs text-red-600 mt-1">{teamOverallStats.serve.miss}失点</p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">ブロック</h4>
                  <p className="text-3xl font-bold text-amber-600">{teamOverallStats.block.successRate.toFixed(1)}%</p>
                  <p className="text-sm text-gray-600 mt-1">{teamOverallStats.block.point}得点 / {teamOverallStats.block.total}回</p>
                  <p className="text-xs text-red-600 mt-1">{teamOverallStats.block.miss}失点</p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">レセプション</h4>
                  <p className="text-3xl font-bold text-purple-600">{teamOverallStats.reception.successRate.toFixed(1)}%</p>
                  <p className="text-sm text-gray-600 mt-1">A+B: {teamOverallStats.reception.a + teamOverallStats.reception.b} / {teamOverallStats.reception.total}回</p>
                  <p className="text-xs text-red-600 mt-1">{teamOverallStats.reception.miss}失点</p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">ディグ</h4>
                  <p className="text-3xl font-bold text-blue-600">{teamOverallStats.dig.successRate.toFixed(1)}%</p>
                  <p className="text-sm text-gray-600 mt-1">{teamOverallStats.dig.success}成功 / {teamOverallStats.dig.total}回</p>
                  <p className="text-xs text-red-600 mt-1">{teamOverallStats.dig.miss}失敗</p>
                </div>
              </div>
            </div>

            {/* 平均値 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
                <h3 className="text-lg font-semibold mb-4 text-gray-900">試合平均得点</h3>
                <p className="text-4xl font-bold bg-gradient-to-br from-indigo-600 to-blue-600 bg-clip-text text-transparent">{teamOverallStats.avgPointsPerMatch.toFixed(1)}</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
                <h3 className="text-lg font-semibold mb-4 text-gray-900">試合平均失点</h3>
                <p className="text-4xl font-bold bg-gradient-to-br from-red-500 to-red-600 bg-clip-text text-transparent">{teamOverallStats.avgErrorsPerMatch.toFixed(1)}</p>
              </div>
            </div>

            {/* チーム推移グラフ */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
              <h3 className="text-xl font-semibold mb-4">チームパフォーマンス推移</h3>
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

            {/* 成功率推移グラフ */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
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

            {/* 弱点分析 */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
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
          </div>
        )}

        {/* 選手別統計ビュー */}
        {viewMode === 'player' && (
          <div className="space-y-6">
            {/* 選手選択 */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
              <label className="block text-sm font-semibold text-gray-700 mb-2">選手選択（個別統計表示）</label>
              <select
                value={selectedPlayerId}
                onChange={(e) => setSelectedPlayerId(e.target.value)}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-full md:w-auto"
              >
                <option value="all">全選手（一覧表示）</option>
                {players.map(player => (
                  <option key={player.id} value={player.id}>{player.displayName}</option>
                ))}
              </select>
            </div>

            {/* 選手一覧表示 */}
            {selectedPlayerId === 'all' && (
              <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
                <h3 className="text-xl font-semibold mb-6 text-gray-900">選手別統計一覧（総得点順）</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">選手名</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">出場試合</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">総得点</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">総失点</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">アタック</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">サーブ</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ブロック</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">レセプション</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {playerStats.map((stat) => (
                        <tr key={stat.playerId} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">{stat.playerName}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-gray-700">{stat.matches}</td>
                          <td className="px-4 py-3 whitespace-nowrap font-bold text-indigo-600">{stat.totalPoints}</td>
                          <td className="px-4 py-3 whitespace-nowrap font-bold text-red-600">{stat.totalErrors}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                            {stat.attack.successRate.toFixed(1)}% ({stat.attack.point}/{stat.attack.total})
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                            {stat.serve.successRate.toFixed(1)}% ({stat.serve.point}/{stat.serve.total})
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                            {stat.block.successRate.toFixed(1)}% ({stat.block.point}/{stat.block.total})
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                            {stat.reception.successRate.toFixed(1)}% (A+B: {stat.reception.a + stat.reception.b}/{stat.reception.total})
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 個別選手統計 */}
            {selectedPlayerId !== 'all' && (() => {
              const playerStat = playerStats.find(p => p.playerId === selectedPlayerId);
              if (!playerStat) return null;
              
              return (
                <div className="space-y-6">
                  {/* 選手基本統計 */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">出場試合数</h3>
                      <p className="text-3xl font-bold text-gray-700">{playerStat.matches}</p>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">総得点</h3>
                      <p className="text-3xl font-bold text-indigo-600">{playerStat.totalPoints}</p>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">総失点</h3>
                      <p className="text-3xl font-bold text-red-600">{playerStat.totalErrors}</p>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">得失点差</h3>
                      <p className={`text-3xl font-bold ${playerStat.totalPoints - playerStat.totalErrors >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {playerStat.totalPoints - playerStat.totalErrors > 0 ? '+' : ''}{playerStat.totalPoints - playerStat.totalErrors}
                      </p>
                    </div>
                  </div>

                  {/* スキル別統計 */}
                  <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
                    <h3 className="text-xl font-semibold mb-6 text-gray-900">スキル別統計</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">アタック</h4>
                        <p className="text-2xl font-bold text-indigo-600">{playerStat.attack.successRate.toFixed(1)}%</p>
                        <p className="text-sm text-gray-600 mt-1">{playerStat.attack.point}得点 / {playerStat.attack.total}回</p>
                        <p className="text-xs text-red-600 mt-1">{playerStat.attack.miss}失点</p>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">サーブ</h4>
                        <p className="text-2xl font-bold text-green-600">{playerStat.serve.successRate.toFixed(1)}%</p>
                        <p className="text-sm text-gray-600 mt-1">{playerStat.serve.point}得点 / {playerStat.serve.total}回</p>
                        <p className="text-xs text-red-600 mt-1">{playerStat.serve.miss}失点</p>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">ブロック</h4>
                        <p className="text-2xl font-bold text-amber-600">{playerStat.block.successRate.toFixed(1)}%</p>
                        <p className="text-sm text-gray-600 mt-1">{playerStat.block.point}得点 / {playerStat.block.total}回</p>
                        <p className="text-xs text-red-600 mt-1">{playerStat.block.miss}失点</p>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">レセプション</h4>
                        <p className="text-2xl font-bold text-purple-600">{playerStat.reception.successRate.toFixed(1)}%</p>
                        <p className="text-sm text-gray-600 mt-1">A+B: {playerStat.reception.a + playerStat.reception.b} / {playerStat.reception.total}回</p>
                        <p className="text-xs text-red-600 mt-1">{playerStat.reception.miss}失点</p>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">ディグ</h4>
                        <p className="text-2xl font-bold text-blue-600">{playerStat.dig.successRate.toFixed(1)}%</p>
                        <p className="text-sm text-gray-600 mt-1">{playerStat.dig.success}成功 / {playerStat.dig.total}回</p>
                        <p className="text-xs text-red-600 mt-1">{playerStat.dig.miss}失敗</p>
                      </div>
                    </div>
                  </div>

                  {/* 選手パフォーマンス推移 */}
                  <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
                    <h3 className="text-xl font-semibold mb-4">パフォーマンス推移</h3>
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
                  <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
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
              );
            })()}
          </div>
        )}

        {/* 試合別統計ビュー */}
        {viewMode === 'match' && (
          <div className="space-y-6">
            {/* 試合選択 */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
              <label className="block text-sm font-semibold text-gray-700 mb-2">試合選択（個別統計表示）</label>
              <select
                value={selectedMatchId}
                onChange={(e) => setSelectedMatchId(e.target.value)}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-full md:w-auto"
              >
                <option value="all">全試合（一覧表示）</option>
                {matches.map(match => (
                  <option key={match.id} value={match.id}>
                    {match.opponent} - {match.matchDate.toDate().toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>

            {/* 試合一覧表示 */}
            {selectedMatchId === 'all' && (
              <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
                <h3 className="text-xl font-semibold mb-6 text-gray-900">試合別統計一覧</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">対戦相手</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">日付</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">セット</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">総得点</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">総失点</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">アタック</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">サーブ</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">レセプション</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {matchStats.map((stat) => (
                        <tr key={stat.matchId} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">{stat.opponent}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-gray-700">{stat.date}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                            {stat.wonSets}勝{stat.lostSets}敗 ({stat.totalOurScore}-{stat.totalOpponentScore})
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap font-bold text-indigo-600">{stat.totalPoints}</td>
                          <td className="px-4 py-3 whitespace-nowrap font-bold text-red-600">{stat.totalErrors}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                            {stat.attack.successRate.toFixed(1)}% ({stat.attack.point}/{stat.attack.total})
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                            {stat.serve.successRate.toFixed(1)}% ({stat.serve.point}/{stat.serve.total})
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                            {stat.reception.successRate.toFixed(1)}% (A+B: {stat.reception.a + stat.reception.b}/{stat.reception.total})
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 個別試合統計 */}
            {selectedMatchId !== 'all' && (() => {
              const matchStat = matchStats.find(m => m.matchId === selectedMatchId);
              if (!matchStat) return null;
              
              return (
                <div className="space-y-6">
                  {/* 試合基本情報 */}
                  <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">対戦相手</h3>
                        <p className="text-2xl font-bold text-gray-900">{matchStat.opponent}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">試合日</h3>
                        <p className="text-xl font-semibold text-gray-700">{matchStat.date}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">セット結果</h3>
                        <p className="text-2xl font-bold text-gray-900">{matchStat.wonSets}勝{matchStat.lostSets}敗</p>
                        <p className="text-sm text-gray-600 mt-1">総スコア: {matchStat.totalOurScore}-{matchStat.totalOpponentScore}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">試合結果</h3>
                        <p className={`text-xl font-bold ${matchStat.wonSets > matchStat.lostSets ? 'text-green-600' : matchStat.wonSets < matchStat.lostSets ? 'text-red-600' : 'text-gray-600'}`}>
                          {matchStat.wonSets > matchStat.lostSets ? '勝利' : matchStat.wonSets < matchStat.lostSets ? '敗北' : '引き分け'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* セットスコア */}
                  <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
                    <h3 className="text-xl font-semibold mb-4">セットスコア</h3>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      {matchStat.setScores.map((set, index) => (
                        <div key={index} className={`p-4 rounded-lg border-2 ${set.ourScore > set.opponentScore ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}`}>
                          <p className="text-sm font-semibold text-gray-700 mb-2">Set {set.setNumber}</p>
                          <p className="text-2xl font-bold text-gray-900">{set.ourScore} - {set.opponentScore}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* スキル別統計 */}
                  <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
                    <h3 className="text-xl font-semibold mb-6 text-gray-900">スキル別統計</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">アタック</h4>
                        <p className="text-2xl font-bold text-indigo-600">{matchStat.attack.successRate.toFixed(1)}%</p>
                        <p className="text-sm text-gray-600 mt-1">{matchStat.attack.point}得点 / {matchStat.attack.total}回</p>
                        <p className="text-xs text-red-600 mt-1">{matchStat.attack.miss}失点</p>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">サーブ</h4>
                        <p className="text-2xl font-bold text-green-600">{matchStat.serve.successRate.toFixed(1)}%</p>
                        <p className="text-sm text-gray-600 mt-1">{matchStat.serve.point}得点 / {matchStat.serve.total}回</p>
                        <p className="text-xs text-red-600 mt-1">{matchStat.serve.miss}失点</p>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">ブロック</h4>
                        <p className="text-2xl font-bold text-amber-600">{matchStat.block.successRate.toFixed(1)}%</p>
                        <p className="text-sm text-gray-600 mt-1">{matchStat.block.point}得点 / {matchStat.block.total}回</p>
                        <p className="text-xs text-red-600 mt-1">{matchStat.block.miss}失点</p>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">レセプション</h4>
                        <p className="text-2xl font-bold text-purple-600">{matchStat.reception.successRate.toFixed(1)}%</p>
                        <p className="text-sm text-gray-600 mt-1">A+B: {matchStat.reception.a + matchStat.reception.b} / {matchStat.reception.total}回</p>
                        <p className="text-xs text-red-600 mt-1">{matchStat.reception.miss}失点</p>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">ディグ</h4>
                        <p className="text-2xl font-bold text-blue-600">{matchStat.dig.successRate.toFixed(1)}%</p>
                        <p className="text-sm text-gray-600 mt-1">{matchStat.dig.success}成功 / {matchStat.dig.total}回</p>
                        <p className="text-xs text-red-600 mt-1">{matchStat.dig.miss}失敗</p>
                      </div>
                    </div>
                  </div>

                  {/* 得点・失点サマリー */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
                      <h3 className="text-lg font-semibold mb-4 text-gray-900">総得点</h3>
                      <p className="text-4xl font-bold bg-gradient-to-br from-indigo-600 to-blue-600 bg-clip-text text-transparent">{matchStat.totalPoints}</p>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
                      <h3 className="text-lg font-semibold mb-4 text-gray-900">総失点</h3>
                      <p className="text-4xl font-bold bg-gradient-to-br from-red-500 to-red-600 bg-clip-text text-transparent">{matchStat.totalErrors}</p>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </main>
    </div>
  );
}

