"use client";
import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useFirebase } from '@/app/FirebaseProvider';
import { doc, getDoc, collection, getDocs, query, where, writeBatch, serverTimestamp, Timestamp, runTransaction, onSnapshot, updateDoc, orderBy, deleteDoc } from 'firebase/firestore';

// (型定義は変更なし)
interface Match { id: string; opponent: string; matchDate: Timestamp; status: string; }
interface Player { id:string; displayName: string; }
interface RosterMember { playerId: string; position: string; }
interface SetData { id: string; index: number; roster: RosterMember[]; liberos: string[]; status: string; score: { own: number; opponent: number; }; }
interface Event { id: string; playerId: string | null; type: string; result: string; at: Timestamp; }

export default function MatchPage() {
  const { db } = useFirebase();
  const router = useRouter();
  const pathname = usePathname();
  const matchId = pathname.split('/').pop() || '';

  const [match, setMatch] = useState<Match | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [sets, setSets] = useState<SetData[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoster, setSelectedRoster] = useState<Map<string, string>>(new Map());
  const [selectedLiberos, setSelectedLiberos] = useState<Set<string>>(new Set());
  const [activeSet, setActiveSet] = useState<SetData | null>(null);
  const [selectedPlayerForEvent, setSelectedPlayerForEvent] = useState<(Player & { position: string }) | null>(null);
  const [editingSet, setEditingSet] = useState<SetData | null>(null); // ★★★★★ セット編集用のStateを追加 ★★★★★

  // (useEffect群は変更なし)
  useEffect(() => { /* ... */ }, [db, matchId]);
  useEffect(() => { /* ... */ }, [teamId, db, matchId]);
  useEffect(() => {
    // ★★★★★ セット編集状態を考慮 ★★★★★
    if (editingSet) {
      setActiveSet(null);
    } else {
      setActiveSet(sets.find(s => s.status === 'ongoing') || null);
    }
  }, [sets, editingSet]);
  useEffect(() => { /* ... */ }, [activeSet, teamId, db, matchId]);

  const handleRosterChange = (playerId: string, position: string) => { /* ... */ };
  const handleLiberoSelect = (playerId: string) => { /* ... */ };
  const handleStartSet = async () => { /* ... */ };
  const handleSelectPlayerForEvent = (rosterMember: RosterMember) => { /* ... */ };
  const checkSetFinished = (own: number, opp: number, isFinal: boolean) => { /* ... */ };
  const handleRecordEvent = async (type: string, result: string, playerId: string | null = selectedPlayerForEvent?.id || null) => { /* ... */ };
  const handleEndSetManually = async () => { /* ... */ };
  const handleFinishMatchManually = async () => { /* ... */ };
  const handleUndoEvent = async () => { /* ... */ };

  // ★★★★★ 新しい関数を追加 ★★★★★
  const handleEditSetRoster = (set: SetData) => {
    setEditingSet(set);
    const rosterMap = new Map<string, string>();
    set.roster.forEach(member => rosterMap.set(member.playerId, member.position));
    setSelectedRoster(rosterMap);
    setSelectedLiberos(new Set(set.liberos));
  };

  const handleUpdateSetRoster = async () => {
    if (!editingSet || !teamId) return;
    try {
      const rosterData = Array.from(selectedRoster.entries()).map(([playerId, position]) => ({ playerId, position }));
      const setRef = doc(db, `teams/${teamId}/matches/${matchId}/sets/${editingSet.id}`);
      await updateDoc(setRef, {
        roster: rosterData,
        liberos: Array.from(selectedLiberos),
        updatedAt: serverTimestamp(),
      });
      setEditingSet(null); // 編集モードを終了
    } catch (err) {
      console.error(err);
      setError("ロスターの更新に失敗しました。");
    }
  };

  const handleReopenSet = async (setId: string) => {
    if (!teamId || !matchId) return;
    if (activeSet) { alert("進行中のセットがあります。まずそのセットを終了してください。"); return; }
    if (!window.confirm("この終了したセットの記録を再開しますか？")) return;
    try {
      const batch = writeBatch(db);
      const setRef = doc(db, `teams/${teamId}/matches/${matchId}/sets/${setId}`);
      batch.update(setRef, { status: 'ongoing' });
      const matchRef = doc(db, `teams/${teamId}/matches/${matchId}`);
      batch.update(matchRef, { status: 'ongoing' });
      await batch.commit();
    } catch (err) { console.error(err); }
  };
  
  if (loading || !match) return (<main className="..."><p>試合情報を読み込んでいます...</p></main>);
  if (error) return (<main className="..."><p>エラー: {error}</p></main>);

  const ownSetsWon = sets.filter(s => s.status === 'finished' && s.score.own > s.score.opponent).length;
  const opponentSetsWon = sets.filter(s => s.status === 'finished' && s.score.own < s.score.opponent).length;
  const isMatchFinished = match?.status === 'finished';

  const renderRosterSelector = (isEditing = false) => {
    return (
      <div className="bg-white p-6 rounded-b-lg shadow-md">
        <h2 className="text-xl font-semibold mb-1 text-gray-800">
          {isEditing ? `第${editingSet?.index}セットの選手を編集` : `第${sets.length + 1}セットを開始`}
        </h2>
        <p className="text-sm text-gray-700 mb-4">出場する選手と、そのポジションを選択してください。</p>
        <div className="space-y-4">
          {players.map(p => (
            <div key={p.id} className={`p-3 ...`}>
              {/* ... ロスター選択のチェックボックスとセレクトボックス ... */}
            </div>
          ))}
        </div>
        <div className="mt-6 text-center">
          {isEditing ? (
            <div className="flex justify-center gap-4">
              <button onClick={() => setEditingSet(null)} className="bg-gray-400 ...">キャンセル</button>
              <button onClick={handleUpdateSetRoster} className="bg-blue-500 ...">更新</button>
            </div>
          ) : (
            <button onClick={handleStartSet} className="bg-green-500 ...">セット開始</button>
          )}
        </div>
      </div>
    );
  };
  
  const renderContent = () => {
    if (editingSet) {
      return renderRosterSelector(true);
    }
    // ... (既存のrenderContentのロジックはほぼ同じ)
  };
  
  return (
    <main className="min-h-screen bg-gray-100 p-2 sm:p-8">
      <div className="w-full max-w-5xl mx-auto">
        <header className="bg-white ...">
          {/* ... */}
        </header>
        {isMatchFinished ? (
          <div className="bg-white p-8 rounded-b-lg shadow-md text-center">
            {/* ... 試合終了UI ... */}
            <div className="mt-8">
              <h4 className="text-lg font-semibold mb-2 text-gray-800">終了したセットの編集</h4>
              <ul className="space-y-2">
                {sets.map(set => (
                  <li key={set.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-md">
                    <span className="text-gray-800 font-medium">第{set.index}セット ({set.score.own} - {set.score.opponent})</span>
                    <div className="flex gap-2">
                      <button onClick={() => handleEditSetRoster(set)} className="px-3 py-1 bg-gray-500 text-white text-xs font-semibold rounded-md hover:bg-gray-600">選手</button>
                      <button onClick={() => handleReopenSet(set.id)} className="px-3 py-1 bg-green-500 text-white text-xs font-semibold rounded-md hover:bg-green-600">記録</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : activeSet ? (
          <div className="bg-white ..."> {/* ... 記録UI ... */} </div>
        ) : sets.length > 0 ? (
          <div className="bg-white p-6 rounded-b-lg shadow-md">
            <div className="p-8 text-center">
              <h3 className="text-2xl font-bold mb-4 text-gray-800">セット間</h3>
              <div className="flex justify-center items-center gap-4">
                <button onClick={handleGoToNextSet} className="bg-green-500 ...">次のセットへ ({sets.length + 1})</button>
                <button onClick={handleFinishMatchManually} className="bg-red-500 ...">試合終了</button>
              </div>
              <div className="mt-8">
                <h4 className="text-lg font-semibold mb-2 text-gray-800">終了したセットの編集</h4>
                <ul className="space-y-2">
                  {sets.map(set => (
                    <li key={set.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-md">
                      <span className="text-gray-800 font-medium">第{set.index}セット ({set.score.own} - {set.score.opponent})</span>
                      <div className="flex gap-2">
                        <button onClick={() => handleEditSetRoster(set)} className="px-3 py-1 bg-gray-500 text-white text-xs font-semibold rounded-md hover:bg-gray-600">選手</button>
                        <button onClick={() => handleReopenSet(set.id)} className="px-3 py-1 bg-green-500 text-white text-xs font-semibold rounded-md hover:bg-green-600">記録</button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : (
          renderRosterSelector()
        )}
      </div>
    </main>
  );
}