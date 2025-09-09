"use client";
import { useFirebase } from "../FirebaseProvider";
import { useState, useEffect, FormEvent } from "react";
import { useRouter } from 'next/navigation';
import { collection, query, getDocs, doc, addDoc, serverTimestamp, onSnapshot, deleteDoc, updateDoc, writeBatch } from "firebase/firestore";
import Link from 'next/link';

interface Player { id: string; displayName: string; }
interface Match { id: string; opponent: string; matchDate: { seconds: number, nanoseconds: number }; status: string; }

export default function DashboardPage() {
  const { user, auth, db, loading: authLoading, teamInfo, setTeamInfo } = useFirebase();
  const router = useRouter();
  
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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
      console.error(err); setError("選手リストの取得に失敗しました。"); setLoadingData(false);
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
    if (!newPlayerName.trim() || !teamInfo?.id) return;
    try {
      await addDoc(collection(db, `teams/${teamInfo.id}/players`), {
        displayName: newPlayerName.trim(), active: true,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      setNewPlayerName('');
    } catch (err) { console.error(err); setError("選手の追加に失敗しました。"); }
  };
  
  const handleDeletePlayer = async (playerId: string) => {
    if (!window.confirm("この選手を削除しますか？")) return;
    if (!teamInfo?.id) return;
    try {
      await deleteDoc(doc(db, `teams/${teamInfo.id}/players/${playerId}`));
    } catch (err) { console.error(err); setError("選手の削除に失敗しました。"); }
  };
  
  const handleOpenModal = (player: Player) => { setEditingPlayer(player); setIsModalOpen(true); };
  const handleCloseModal = () => { setIsModalOpen(false); setEditingPlayer(null); };

  const handleUpdatePlayer = async () => {
    if (!editingPlayer || !teamInfo?.id) return;
    try {
      await updateDoc(doc(db, `teams/${teamInfo.id}/players/${editingPlayer.id}`), {
        displayName: editingPlayer.displayName,
        updatedAt: serverTimestamp(),
      });
      handleCloseModal();
    } catch (err) { console.error(err); setError("選手の更新に失敗しました。"); }
  };

  const handleFinishMatch = async (matchId: string) => {
    if (!teamInfo?.id || !window.confirm("この試合を終了しますか？")) return;
    try {
      const batch = writeBatch(db);
      const matchRef = doc(db, `teams/${teamInfo.id}/matches/${matchId}`);
      batch.update(matchRef, { status: 'finished', updatedAt: serverTimestamp() });
      const q = query(collection(db, `teams/${teamInfo.id}/matches/${matchId}/sets`), where("status", "==", "ongoing"));
      const ongoingSetsSnap = await getDocs(q);
      ongoingSetsSnap.forEach(d => batch.update(d.ref, { status: 'finished', updatedAt: serverTimestamp() }));
      await batch.commit();
      router.push('/dashboard');
    } catch (err) { console.error(err); setError("試合の終了処理に失敗しました。"); }
  };

  const handleDeleteMatch = async (matchId: string) => {
    if (!teamInfo?.id) return;
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
    } catch (err) { console.error("試合の削除に失敗しました: ", err); setError("試合の削除中にエラーが発生しました。"); }
  };
  
  const handleLeaveTeam = () => {
    if(window.confirm("現在のチームから退出しますか？\n再度参加するにはチームコードの入力が必要です。")) {
      setTeamInfo(null);
      router.push('/');
    }
  }

  if (authLoading || !user || loadingData) {
    return (<main className="flex min-h-screen items-center justify-center bg-gray-100"><p>チームデータを読み込んでいます...</p></main>);
  }
  
  if (error) return (<main className="flex min-h-screen items-center justify-center bg-gray-100"><p className="text-red-500 max-w-md text-center">エラー: {error}</p></main>);

  return (
    <main className="flex min-h-screen flex-col items-center p-8 bg-gray-100">
      <div className="w-full max-w-4xl space-y-8">
        <header className="flex justify-between items-center bg-white p-4 rounded-lg shadow-md">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-900">{teamInfo?.name || 'ダッシュボード'}</h1>
            <Link href="/matches/new"><span className="bg-green-500 text-white font-bold py-2 px-4 rounded-md hover:bg-green-600 transition-colors text-sm">＋ 新しい試合</span></Link>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={handleLeaveTeam} className="text-xs text-gray-500 hover:text-red-600">チーム退出</button>
            <button onClick={() => auth.signOut()} className="px-4 py-2 bg-red-500 text-white font-semibold rounded-md hover:bg-red-600 transition-colors text-sm">ログアウト</button>
          </div>
        </header>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">選手管理</h2>
          <form onSubmit={handleAddPlayer} className="flex flex-col sm:flex-row gap-4 mb-6">
            <input type="text" value={newPlayerName} onChange={(e) => setNewPlayerName(e.target.value)} placeholder="選手名" className="flex-grow border border-gray-300 p-2 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" required />
            <button type="submit" className="bg-blue-500 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-600 transition-colors">追加</button>
          </form>
          <ul className="divide-y divide-gray-200">{players.length === 0 ? <p className="text-center text-gray-700 py-4">まだ選手が登録されていません。</p> : players.map((p) => (<li key={p.id} className="py-3 flex justify-between items-center"><div><p className="text-md font-medium text-gray-900">{p.displayName}</p></div><div className="flex gap-2"><button onClick={() => handleOpenModal(p)} className="px-3 py-1 bg-yellow-500 text-white text-xs font-semibold rounded-md hover:bg-yellow-600">編集</button><button onClick={() => handleDeletePlayer(p.id)} className="px-3 py-1 bg-red-500 text-white text-xs font-semibold rounded-md hover:bg-red-600">削除</button></div></li>))}</ul>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">試合リスト</h2>
          <ul className="divide-y divide-gray-200">{matches.length === 0 ? <p className="text-center text-gray-700 py-4">まだ試合が作成されていません。</p> : matches.map((m) => (<li key={m.id} className="py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center"><div className="mb-2 sm:mb-0"><p className="text-lg font-medium text-gray-900">{m.opponent}</p><p className="text-sm text-gray-700">{new Date(m.matchDate.seconds * 1000).toLocaleDateString()}</p><p className={`text-sm font-bold ${m.status === 'finished' ? 'text-gray-600' : 'text-green-600'}`}>{m.status === 'finished' ? '試合終了' : '試合中/予定'}</p></div><div className="flex flex-wrap gap-2 justify-end items-center" style={{ minWidth: '280px' }}><Link href={`/matches/${m.id}/summary`}><span className="px-3 py-2 bg-gray-500 text-white text-xs font-semibold rounded-md hover:bg-gray-600">集計</span></Link><Link href={`/matches/${m.id}`}><span className={`px-3 py-2 text-white text-xs font-semibold rounded-md ${m.status === 'finished' ? 'bg-purple-500 hover:bg-purple-600' : 'bg-blue-500 hover:bg-blue-600'}`}>{m.status === 'finished' ? '編集' : '記録'}</span></Link>{m.status !== 'finished' && (<button onClick={() => handleFinishMatch(m.id)} className="px-3 py-2 bg-yellow-600 text-white text-xs font-semibold rounded-md hover:bg-yellow-700">試合終了</button>)}<button onClick={() => handleDeleteMatch(m.id)} className="px-3 py-2 bg-red-500 text-white text-xs font-semibold rounded-md hover:bg-red-600">削除</button></div></li>))}</ul>
        </div>
      </div>
      {isModalOpen && editingPlayer && (<div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center p-4"><div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md"><h2 className="text-2xl font-bold mb-6 text-gray-800">選手名を編集</h2><form onSubmit={(e) => { e.preventDefault(); handleUpdatePlayer(); }}><div className="mb-6"><label htmlFor="edit-player-name" className="block text-sm font-medium text-gray-700 mb-1">選手名</label><input id="edit-player-name" type="text" value={editingPlayer.displayName} onChange={(e) => setEditingPlayer({ ...editingPlayer, displayName: e.target.value })} className="w-full border border-gray-300 p-2 rounded-md text-gray-900" required /></div><div className="flex justify-end gap-4"><button type="button" onClick={handleCloseModal} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">キャンセル</button><button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">更新</button></div></form></div></div>)}
    </main>
  );
}