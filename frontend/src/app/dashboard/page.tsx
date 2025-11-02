"use client";
import { useFirebase } from "../FirebaseProvider";
import { useState, useEffect, FormEvent, useMemo } from "react";
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs, doc, addDoc, serverTimestamp, onSnapshot, deleteDoc, updateDoc, writeBatch } from "firebase/firestore";
import Link from 'next/link';
import { StatCard } from "@/components/StatCard";
import { ActionCard } from "@/components/ActionCard";

interface Player { id: string; displayName: string; }
interface Match { id: string; opponent: string; matchDate: { seconds: number, nanoseconds: number }; status: string; }
interface TeamInfo { id: string; name: string; }

export default function DashboardPage() {
  const { user, auth, db, loading: authLoading } = useFirebase();
  const router = useRouter();
  const [teamInfo, setTeamInfo] = useState<TeamInfo | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const storedTeam = localStorage.getItem('currentTeam');
    if (storedTeam) {
      setTeamInfo(JSON.parse(storedTeam));
    } else {
      router.push('/');
    }
  }, [router]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!db || !teamInfo?.id) {
      setLoadingData(true);
      return;
    }
    const teamId = teamInfo.id;
    setLoadingData(true);

    const playersRef = collection(db, `teams/${teamId}/players`);
    const playersUnsubscribe = onSnapshot(playersRef, (snapshot) => {
      setPlayers(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Player)));
      setLoadingData(false);
    }, (err) => {
      console.error(err);
      setError("選手リストの取得に失敗しました。");
      setLoadingData(false);
    });

    const matchesRef = collection(db, `teams/${teamId}/matches`);
    const matchesUnsubscribe = onSnapshot(matchesRef, (snapshot) => {
      setMatches(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Match)));
    });

    return () => {
      playersUnsubscribe();
      matchesUnsubscribe();
    }
  }, [db, teamInfo]);

  const handleAddPlayer = async (e: FormEvent) => {
    e.preventDefault();
    if (!db || !newPlayerName.trim() || !teamInfo?.id) return;
    try {
      await addDoc(collection(db, `teams/${teamInfo.id}/players`), {
        displayName: newPlayerName.trim(),
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setNewPlayerName('');
    } catch (err) {
      console.error(err);
      setError("選手の追加に失敗しました。");
    }
  };

  const handleDeletePlayer = async (playerId: string) => {
    if (!db || !window.confirm("この選手を削除しますか？")) return;
    if (!teamInfo?.id) return;
    try {
      await deleteDoc(doc(db, `teams/${teamInfo.id}/players/${playerId}`));
    } catch (err) {
      console.error(err);
      setError("選手の削除に失敗しました。");
    }
  };

  const handleOpenModal = (player: Player) => {
    setEditingPlayer(player);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingPlayer(null);
  };

  const handleUpdatePlayer = async () => {
    if (!db || !editingPlayer || !teamInfo?.id) return;
    try {
      await updateDoc(doc(db, `teams/${teamInfo.id}/players/${editingPlayer.id}`), {
        displayName: editingPlayer.displayName,
        updatedAt: serverTimestamp(),
      });
      handleCloseModal();
    } catch (err) {
      console.error(err);
      setError("選手の更新に失敗しました。");
    }
  };

  const handleFinishMatch = async (matchId: string) => {
    if (!db || !teamInfo?.id || !window.confirm("この試合を終了しますか？")) return;
    try {
      const batch = writeBatch(db);
      const matchRef = doc(db, `teams/${teamInfo.id}/matches/${matchId}`);
      batch.update(matchRef, { status: 'finished', updatedAt: serverTimestamp() });
      const q = query(collection(db, `teams/${teamInfo.id}/matches/${matchId}/sets`), where("status", "==", "ongoing"));
      const ongoingSetsSnap = await getDocs(q);
      ongoingSetsSnap.forEach(d => batch.update(d.ref, { status: 'finished', updatedAt: serverTimestamp() }));
      await batch.commit();
    } catch (err) {
      console.error(err);
      setError("試合の終了処理に失敗しました。");
    }
  };

  const handleDeleteMatch = async (matchId: string) => {
    if (!db || !teamInfo?.id) return;
    if (!window.confirm("この試合のすべての記録を完全に削除します。よろしいですか？")) return;
    try {
      const setsRef = collection(db, `teams/${teamInfo.id}/matches/${matchId}/sets`);
      const setsSnap = await getDocs(setsRef);
      const batch = writeBatch(db);
      for (const setDoc of setsSnap.docs) {
        const eventsRef = collection(db, `teams/${teamInfo.id}/matches/${matchId}/sets/${setDoc.id}/events`);
        const eventsSnap = await getDocs(eventsRef);
        eventsSnap.forEach(eventDoc => batch.delete(eventDoc.ref));
        batch.delete(setDoc.ref);
      }
      const matchRef = doc(db, `teams/${teamInfo.id}/matches/${matchId}`);
      batch.delete(matchRef);
      await batch.commit();
    } catch (err) {
      console.error("試合の削除に失敗しました: ", err);
      setError("試合の削除中にエラーが発生しました。");
    }
  };
  const handleLogout = () => {
    localStorage.removeItem('currentTeam');
    auth.signOut();
    router.push('/');
  };

  // 統計データの計算
  const stats = useMemo(() => {
    const finishedMatches = matches.filter(m => m.status === 'finished');
    const ongoingMatches = matches.filter(m => m.status === 'ongoing' || m.status === 'scheduled');
    const recentMatches = matches.slice(0, 5);
    
    // 今週の試合数（簡易版）
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const recentWeekMatches = matches.filter(m => {
      const matchDate = new Date(m.matchDate.seconds * 1000);
      return matchDate >= weekAgo;
    });

    return {
      totalMatches: matches.length,
      finishedMatches: finishedMatches.length,
      ongoingMatches: ongoingMatches.length,
      totalPlayers: players.length,
      recentWeekMatches: recentWeekMatches.length,
      recentMatches,
    };
  }, [matches, players]);

  if (authLoading || !user || !teamInfo) return (<main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100"><p className="text-gray-600">チーム情報を読み込んでいます...</p></main>);
  if (loadingData) return (<main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100"><p className="text-gray-600">データを読み込んでいます...</p></main>);
  if (error) return (<main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100"><p className="text-red-500 max-w-md text-center bg-white p-4 rounded-lg shadow-md">エラー: {error}</p></main>);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-6">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                {teamInfo?.name || 'ダッシュボード'}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                ログアウト
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 統計サマリーカード */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="総試合数"
            value={stats.totalMatches}
            icon={
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            }
            trend={stats.recentWeekMatches > 0 ? { value: `今週 ${stats.recentWeekMatches}試合`, isPositive: true } : undefined}
            gradient="bg-gradient-to-br from-indigo-500 to-indigo-600"
          />
          <StatCard
            title="登録選手"
            value={stats.totalPlayers}
            icon={
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            }
            gradient="bg-gradient-to-br from-green-500 to-emerald-600"
          />
          <StatCard
            title="終了済み"
            value={stats.finishedMatches}
            icon={
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            gradient="bg-gradient-to-br from-purple-500 to-pink-600"
          />
          <StatCard
            title="進行中・予定"
            value={stats.ongoingMatches}
            icon={
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            gradient="bg-gradient-to-br from-amber-500 to-orange-600"
          />
        </div>

        {/* メインコンテンツ - グリッドレイアウト */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* クイックアクション */}
          <div className="lg:col-span-1 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">クイックアクション</h2>
            <div className="space-y-3">
              <ActionCard
                title="新しい試合"
                description="試合を開始して記録を開始"
                href="/matches/new"
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                }
                colorClass="bg-green-500"
              />
              <ActionCard
                title="統計分析"
                description="チーム・選手の統計を確認"
                href="/analytics"
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                }
                colorClass="bg-indigo-500"
              />
              <ActionCard
                title="シーズン管理"
                description="シーズンを管理・設定"
                href="/seasons"
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                }
                colorClass="bg-purple-500"
              />
            </div>
          </div>

          {/* 選手管理カード */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">選手管理</h2>
                  <span className="text-sm text-gray-500">{stats.totalPlayers}名</span>
                </div>
              </div>
              <div className="p-6">
                <form onSubmit={handleAddPlayer} className="flex flex-col sm:flex-row gap-3 mb-6">
                  <input
                    type="text"
                    value={newPlayerName}
                    onChange={(e) => setNewPlayerName(e.target.value)}
                    placeholder="選手名を入力"
                    className="flex-grow border border-gray-300 rounded-lg px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    required
                  />
                  <button
                    type="submit"
                    className="bg-indigo-600 text-white font-semibold py-2 px-6 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm hover:shadow-md"
                  >
                    追加
                  </button>
                </form>
                {players.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    <p>まだ選手が登録されていません</p>
                    <p className="text-sm mt-1">選手を追加して開始しましょう</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {players.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-indigo-300 hover:shadow-sm transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-semibold">
                            {p.displayName.charAt(0)}
                          </div>
                          <p className="font-medium text-gray-900">{p.displayName}</p>
                        </div>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleOpenModal(p)}
                            className="p-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="編集"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeletePlayer(p.id)}
                            className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="削除"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 試合リスト */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">試合リスト</h2>
              <span className="text-sm text-gray-500">{stats.totalMatches}試合</span>
            </div>
          </div>
          <div className="divide-y divide-gray-200">
            {matches.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <p>まだ試合が作成されていません</p>
                <p className="text-sm mt-1">新しい試合を作成して開始しましょう</p>
              </div>
            ) : (
              matches.map((m) => (
                <div
                  key={m.id}
                  className="p-6 hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">vs {m.opponent}</h3>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          m.status === 'finished'
                            ? 'bg-gray-100 text-gray-700'
                            : m.status === 'ongoing'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {m.status === 'finished' ? '終了' : m.status === 'ongoing' ? '進行中' : '予定'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {new Date(m.matchDate.seconds * 1000).toLocaleDateString('ja-JP', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/matches/${m.id}/summary`}>
                        <span className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors">
                          集計
                        </span>
                      </Link>
                      <Link href={`/matches/${m.id}`}>
                        <span className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                          m.status === 'finished'
                            ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700'
                        }`}>
                          {m.status === 'finished' ? '編集' : '記録'}
                        </span>
                      </Link>
                      {m.status !== 'finished' && (
                        <button
                          onClick={() => handleFinishMatch(m.id)}
                          className="px-4 py-2 bg-amber-100 text-amber-700 text-sm font-medium rounded-lg hover:bg-amber-200 transition-colors"
                        >
                          終了
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteMatch(m.id)}
                        className="px-4 py-2 bg-red-100 text-red-700 text-sm font-medium rounded-lg hover:bg-red-200 transition-colors opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* 編集モーダル */}
      {isModalOpen && editingPlayer && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-2xl font-bold mb-6 text-gray-900">選手名を編集</h2>
            <form onSubmit={(e) => { e.preventDefault(); handleUpdatePlayer(); }}>
              <div className="mb-6">
                <label htmlFor="edit-player-name" className="block text-sm font-medium text-gray-700 mb-2">
                  選手名
                </label>
                <input
                  id="edit-player-name"
                  type="text"
                  value={editingPlayer.displayName}
                  onChange={(e) => setEditingPlayer({ ...editingPlayer, displayName: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  更新
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}