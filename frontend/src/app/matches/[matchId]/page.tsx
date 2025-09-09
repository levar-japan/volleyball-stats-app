"use client";
import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useFirebase } from '@/app/FirebaseProvider';
import { doc, getDoc, collection, getDocs, query, where, writeBatch, serverTimestamp, Timestamp, runTransaction, onSnapshot, updateDoc, orderBy, deleteDoc } from 'firebase/firestore';

// 型定義
interface Match { id: string; opponent: string; matchDate: Timestamp; status: string; }
interface Player { id:string; displayName: string; }
interface RosterMember { playerId: string; position: string; }
interface SetData { id: string; index: number; roster: RosterMember[]; liberos: string[]; status: string; score: { own: number; opponent: number; }; }
interface Event { id: string; playerId: string | null; type: string; result: string; at: Timestamp; inPlayerId?: string; outPlayerId?: string; }

export default function MatchPage() {
  const { db, teamInfo } = useFirebase();
  const router = useRouter();
  const pathname = usePathname();
  const matchId = pathname.split('/').pop() || '';

  const [match, setMatch] = useState<Match | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [sets, setSets] = useState<SetData[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoster, setSelectedRoster] = useState<Map<string, string>>(new Map());
  const [selectedLiberos, setSelectedLiberos] = useState<Set<string>>(new Set());
  const [activeSet, setActiveSet] = useState<SetData | null>(null);
  const [selectedPlayerForEvent, setSelectedPlayerForEvent] = useState<(Player & { position: string }) | null>(null);
  const [isSelectingForNextSet, setIsSelectingForNextSet] = useState(false);
  const [editingSet, setEditingSet] = useState<SetData | null>(null);
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [subInPlayer, setSubInPlayer] = useState<string>('');
  const [subOutPlayer, setSubOutPlayer] = useState<string>('');
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

  useEffect(() => {
    if (!db || !matchId || !teamInfo?.id) return;
    const teamId = teamInfo.id;
    let matchUnsubscribe: (() => void) | undefined;
    const fetchInitialData = async () => {
      setLoading(true); setError(null);
      try {
        const matchRef = doc(db, `teams/${teamId}/matches/${matchId}`);
        matchUnsubscribe = onSnapshot(matchRef, (doc) => {
          if (doc.exists()) { setMatch({ id: doc.id, ...doc.data() } as Match); }
          else { setError("試合が見つかりません。"); }
        });

        const playersRef = collection(db, `teams/${teamId}/players`);
        const playersSnap = await getDocs(playersRef);
        setPlayers(playersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Player)));
      } catch (err) { setError((err as Error).message); setLoading(false); }
    };
    fetchInitialData();
    return () => { if (matchUnsubscribe) matchUnsubscribe(); }
  }, [db, matchId, teamInfo]);

  useEffect(() => {
    if (!teamInfo?.id) return;
    const teamId = teamInfo.id;
    const setsRef = collection(db, `teams/${teamId}/matches/${matchId}/sets`);
    const q = query(setsRef, orderBy("index"));
    const unsubscribe = onSnapshot(q, (snapshot) => { setSets(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as SetData))); setLoading(false); }, (err) => { console.error(err); setError("セット情報の取得に失敗しました。"); setLoading(false); });
    return () => unsubscribe();
  }, [teamInfo, db, matchId]);

  useEffect(() => {
    if (isSelectingForNextSet || editingSet) {
      setActiveSet(null);
      return;
    }
    const currentActiveSet = sets.find(s => s.status === 'ongoing') || null;
    setActiveSet(currentActiveSet);
  }, [sets, isSelectingForNextSet, editingSet]);

  useEffect(() => {
    if (!activeSet || !teamInfo?.id) { setEvents([]); return; }
    const teamId = teamInfo.id;
    const eventsRef = collection(db, `teams/${teamId}/matches/${matchId}/sets/${activeSet.id}/events`);
    const q = query(eventsRef, orderBy("at", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setEvents(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Event)));
    });
    return () => unsubscribe();
  }, [activeSet, teamInfo, db, matchId]);

  const handleRosterChange = (playerId: string, position: string) => {
    setSelectedRoster(prev => {
      const newRoster = new Map(prev);
      if (position) {
        newRoster.set(playerId, position);
      } else {
        newRoster.delete(playerId);
      }
      return newRoster;
    });
  };
  const handleLiberoSelect = (playerId: string) => {
    setSelectedLiberos(prev => {
      const s = new Set(prev);
      if (s.has(playerId)) {
        s.delete(playerId);
      } else if (s.size < 2) {
        s.add(playerId);
      }
      return s;
    });
  };
  const handleStartSet = async () => {
    if (selectedRoster.size === 0) { alert("出場選手を1人以上選択してください。"); return; }
    if (!teamInfo?.id || !matchId) { return; }
    const teamId = teamInfo.id;
    try {
      const batch = writeBatch(db);
      const newSetRef = doc(collection(db, `teams/${teamId}/matches/${matchId}/sets`));
      const rosterData = Array.from(selectedRoster.entries()).map(([playerId, position]) => ({ playerId, position }));
      batch.set(newSetRef, { index: sets.length + 1, status: 'ongoing', roster: rosterData, liberos: Array.from(selectedLiberos), score: { own: 0, opponent: 0 }, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      const matchRef = doc(db, `teams/${teamId}/matches/${matchId}`);
      batch.update(matchRef, { status: 'ongoing', updatedAt: serverTimestamp() });
      await batch.commit();
      setIsSelectingForNextSet(false);
    } catch (e) {
      console.error(e);
    }
  };
  const handleSelectPlayerForEvent = (rosterMember: RosterMember) => {
    const player = players.find(p => p.id === rosterMember.playerId);
    if (player) {
      setSelectedPlayerForEvent({ ...player, position: rosterMember.position });
    }
  };
  const checkSetFinished = (own: number, opp: number, isFinal: boolean) => {
    const pts = isFinal ? 15 : 25;
    if (own >= pts && own >= opp + 2) return 'own_won';
    if (opp >= pts && opp >= own + 2) return 'opponent_won';
    return null;
  };
  const handleRecordEvent = async (type: string, result: string, playerId: string | null = selectedPlayerForEvent?.id || null) => {
    if (!teamInfo?.id || !matchId || !activeSet) return;
    const teamId = teamInfo.id;
    try {
      await runTransaction(db, async (t) => {
        const setRef = doc(db, `teams/${teamId}/matches/${matchId}/sets/${activeSet.id}`);
        const setDoc = await t.get(setRef);
        if (!setDoc.exists()) throw "Set does not exist!";
        const d = setDoc.data();
        let own = d.score.own;
        let opp = d.score.opponent;
        if (result === 'point' || type === 'opponent_error') {
          own++;
        } else if (result === 'fail' || type === 'own_error') {
          opp++;
        }
        t.set(doc(collection(setRef, 'events')), { setIndex: activeSet.index, playerId, type, result, at: serverTimestamp() });
        const isFinal = activeSet.index >= 4;
        const setResult = checkSetFinished(own, opp, isFinal);
        const newStatus = setResult ? 'finished' : 'ongoing';
        t.update(setRef, { score: { own, opponent: opp }, status: newStatus, updatedAt: serverTimestamp() });
      });
      const setsQuery = query(collection(db, `teams/${teamId}/matches/${matchId}/sets`));
      const setsSnap = await getDocs(setsQuery);
      let ownWon = 0;
      setsSnap.forEach(d => {
        const data = d.data();
        if (data.status === 'finished') {
          if (data.score.own > data.score.opponent) ownWon++;
        }
      });
      if (ownWon >= 3) {
        await updateDoc(doc(db, `teams/${teamId}/matches/${matchId}`), { status: 'finished' });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSelectedPlayerForEvent(null);
    }
  };
  const handleEndSetManually = async () => {
    if (!activeSet || !teamInfo?.id) return;
    const teamId = teamInfo.id;
    if (!window.confirm(`第${activeSet.index}セットを終了しますか？`)) return;
    try {
      await updateDoc(doc(db, `teams/${teamId}/matches/${matchId}/sets/${activeSet.id}`), {
        status: 'finished',
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error(e);
    }
  };
  const handleGoToNextSet = () => {
    setIsSelectingForNextSet(true);
    setSelectedRoster(new Map());
    setSelectedLiberos(new Set());
  };
  const handleFinishMatchManually = async () => {
    if (!teamInfo?.id || !matchId) return;
    const teamId = teamInfo.id;
    if (!window.confirm("この試合を終了しますか？")) return;
    try {
      const matchRef = doc(db, `teams/${teamId}/matches/${matchId}`);
      await updateDoc(matchRef, {
        status: 'finished',
        updatedAt: serverTimestamp(),
      });
      router.push('/dashboard');
    } catch (err) {
      console.error(err);
    }
  };
  const handleUndoEvent = async () => {
    if (events.length === 0 || !teamInfo?.id || !activeSet) return;
    const teamId = teamInfo.id;
    if (!window.confirm("直前の記録を取り消しますか？")) return;
    const lastEvent = events[0];
    try {
      await runTransaction(db, async (t) => {
        const setRef = doc(db, `teams/${teamId}/matches/${matchId}/sets/${activeSet.id}`);
        const setDoc = await t.get(setRef);
        if (!setDoc.exists()) throw "Set does not exist!";
        t.delete(doc(setRef, `events/${lastEvent.id}`));
        const score = setDoc.data().score;
        let own = score.own;
        let opp = score.opponent;
        if (lastEvent.result === 'point' || lastEvent.type === 'opponent_error') own--;
        else if (lastEvent.result === 'fail' || lastEvent.type === 'own_error') opp--;
        t.update(setRef, {
          score: { own, opponent: opp },
          updatedAt: serverTimestamp(),
        });
      });
    } catch (err) {
      console.error("Undo transaction failed: ", err);
    }
  };
  const handleReopenSet = async (setId: string) => {
    if (!teamInfo?.id || !matchId) return;
    const teamId = teamInfo.id;
    if (activeSet) {
      alert("進行中のセットがあります。");
      return;
    }
    if (!window.confirm("この終了したセットの記録を再開しますか？")) return;
    try {
      const batch = writeBatch(db);
      const setRef = doc(db, `teams/${teamId}/matches/${matchId}/sets/${setId}`);
      batch.update(setRef, { status: 'ongoing' });
      const matchRef = doc(db, `teams/${teamId}/matches/${matchId}`);
      batch.update(matchRef, { status: 'ongoing' });
      await batch.commit();
    } catch (err) {
      console.error(err);
    }
  };
  const handleEditSetRoster = (set: SetData) => {
    setEditingSet(set);
    const rosterMap = new Map<string, string>();
    set.roster.forEach(member => rosterMap.set(member.playerId, member.position));
    setSelectedRoster(rosterMap);
    setSelectedLiberos(new Set(set.liberos));
  };
  const handleUpdateSetRoster = async () => {
    if (!editingSet || !teamInfo?.id) return;
    const teamId = teamInfo.id;
    try {
      const rosterData = Array.from(selectedRoster.entries()).map(([playerId, position]) => ({ playerId, position }));
      const setRef = doc(db, `teams/${teamId}/matches/${matchId}/sets/${editingSet.id}`);
      await updateDoc(setRef, {
        roster: rosterData,
        liberos: Array.from(selectedLiberos),
        updatedAt: serverTimestamp(),
      });
      setEditingSet(null);
    } catch (err) {
      console.error(err);
    }
  };
  const handleSubstitution = async () => {
    if (!subInPlayer || !subOutPlayer || !activeSet || !teamInfo?.id) {
      alert("交代する選手を正しく選択してください。");
      return;
    }
    const teamId = teamInfo.id;
    try {
      const newRoster = activeSet.roster.map(member => 
        member.playerId === subOutPlayer ? { ...member, playerId: subInPlayer } : member
      );
      
      const batch = writeBatch(db);
      const setRef = doc(db, `teams/${teamId}/matches/${matchId}/sets/${activeSet.id}`);
      batch.update(setRef, { roster: newRoster, updatedAt: serverTimestamp() });

      const eventRef = doc(collection(setRef, 'events'));
      batch.set(eventRef, {
        setIndex: activeSet.index,
        type: 'substitution',
        result: 'in-out',
        inPlayerId: subInPlayer,
        outPlayerId: subOutPlayer,
        at: serverTimestamp(),
        playerId: null,
      });
      
      await batch.commit();

      setIsSubModalOpen(false);
      setSubInPlayer('');
      setSubOutPlayer('');

    } catch (err) {
      console.error(err);
    }
  };
  const handleDeleteEvent = async () => {
    if (!editingEvent || !teamInfo?.id || !matchId || !activeSet) return;
    if (!window.confirm("このプレー記録を削除しますか？")) return;
    const teamId = teamInfo.id;
    try {
      await runTransaction(db, async (t) => {
        const setRef = doc(db, `teams/${teamId}/matches/${matchId}/sets/${activeSet.id}`);
        const setDoc = await t.get(setRef);
        if (!setDoc.exists()) throw "Set does not exist!";

        const eventRef = doc(setRef, `events/${editingEvent.id}`);
        t.delete(eventRef);
        
        const score = setDoc.data().score;
        let own = score.own;
        let opp = score.opponent;
        if (editingEvent.result === 'point' || editingEvent.type === 'opponent_error') own--;
        else if (editingEvent.result === 'fail' || editingEvent.type === 'own_error') opp--;
        
        t.update(setRef, { score: { own, opponent: opp }, updatedAt: serverTimestamp() });
      });
      setEditingEvent(null);
    } catch (err) {
      console.error("Event deletion failed: ", err);
    }
  };

  if (loading || !match) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100">
        <p>試合情報を読み込んでいます...</p>
      </main>
    );
  }
  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100">
        <p className="text-red-500 max-w-md text-center">エラー: {error}</p>
      </main>
    );
  }

  const ownSetsWon = sets.filter(s => s.status === 'finished' && s.score.own > s.score.opponent).length;
  const opponentSetsWon = sets.filter(s => s.status === 'finished' && s.score.own < s.score.opponent).length;
  const isMatchFinished = match?.status === 'finished';
  const benchPlayers = activeSet 
    ? players.filter(p => !activeSet.roster.some(rm => rm.playerId === p.id))
    : [];

  const renderRosterSelector = (isEditing = false) => {
    const targetSet = isEditing ? editingSet : null;
    return (
      <div className="bg-white p-6 rounded-b-lg shadow-md">
        <h2 className="text-xl font-semibold mb-1 text-gray-800">{isEditing ? `第${targetSet?.index}セットの選手を編集` : `${sets.length > 0 ? `第${sets.length + 1}セット` : '最初のセット'}を開始`}</h2>
        <p className="text-sm text-gray-700 mb-4">出場する選手と、そのポジションを選択してください。</p>
        <div className="space-y-4">
          {players.map(p => (
            <div key={p.id} className={`p-3 rounded-lg flex items-center gap-4 ${selectedRoster.has(p.id) ? 'bg-blue-50' : 'bg-gray-50'}`}>
              <input type="checkbox" checked={selectedRoster.has(p.id)} onChange={(e) => { handleRosterChange(p.id, e.target.checked ? 'OH' : ''); }} className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"/>
              <p className="font-semibold text-gray-900 flex-grow">{p.displayName}</p>
              <select value={selectedRoster.get(p.id) || ''} onChange={(e) => handleRosterChange(p.id, e.target.value)} disabled={!selectedRoster.has(p.id)} className="border border-gray-300 p-2 rounded-md text-gray-900 disabled:bg-gray-200">
                <option value="">ポジション</option><option value="S">S</option><option value="MB">MB</option><option value="OH">OH</option><option value="OP">OP</option><option value="L">L</option>
              </select>
            </div>
          ))}
        </div>
        <div className="mt-6 text-center">
          {isEditing ? (
            <div className="flex justify-center gap-4">
              <button onClick={() => setEditingSet(null)} className="px-4 py-2 bg-gray-400 text-white rounded-md hover:bg-gray-500">キャンセル</button>
              <button onClick={handleUpdateSetRoster} className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">更新</button>
            </div>
          ) : (
            <button onClick={handleStartSet} className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg text-lg">セット開始</button>
          )}
        </div>
      </div>
    );
  };
  
  const renderContent = () => {
    if (editingSet) {
      return renderRosterSelector(true);
    }
    if (isMatchFinished) {
      return (
        <div className="bg-white p-8 rounded-b-lg shadow-md text-center">
          <h2 className="text-3xl font-bold mb-4 text-gray-800">試合終了</h2>
          <p className="text-xl text-gray-800">{ownSetsWon} - {opponentSetsWon}</p>
          <p className="text-2xl font-bold mt-2 text-blue-600">{ownSetsWon > opponentSetsWon ? "勝利！" : "敗北"}</p>
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
      );
    }
    
    if (activeSet) {
      return (
        <div className="bg-white rounded-b-lg shadow-md">
          <div className="p-4 border-b flex justify-between items-center">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-center text-gray-800">第{activeSet.index}セット</h2>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setIsSubModalOpen(true)} className="px-3 py-1 bg-blue-500 text-white text-sm font-semibold rounded-md hover:bg-blue-600">選手交代</button>
              <button onClick={handleEndSetManually} className="px-3 py-1 bg-yellow-500 text-white text-sm font-semibold rounded-md hover:bg-yellow-600">セット終了</button>
            </div>
          </div>
          <div className="p-4 border-b">
            <div className="flex justify-around items-center">
              <div className="text-center"><p className="text-lg font-semibold text-gray-800">自チーム</p><p className="text-5xl font-bold text-gray-900">{activeSet.score.own}</p></div>
              <div className="text-2xl font-bold text-gray-400">-</div>
              <div className="text-center"><p className="text-lg font-semibold text-gray-800">{match.opponent}</p><p className="text-5xl font-bold text-gray-900">{activeSet.score.opponent}</p></div>
            </div>
            <div className="mt-4 flex justify-center gap-4">
              <button onClick={() => handleRecordEvent('opponent_error', 'point', null)} className="px-4 py-2 bg-green-100 text-green-800 text-sm font-semibold rounded-md hover:bg-green-200">相手のミス</button>
              <button onClick={() => handleRecordEvent('own_error', 'fail', null)} className="px-4 py-2 bg-red-100 text-red-800 text-sm font-semibold rounded-md hover:bg-red-200">こちらのミス</button>
            </div>
          </div>
          <div className="p-4 bg-gray-50">
            {selectedPlayerForEvent ? (
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="font-bold text-lg mb-2 text-center text-gray-800">{selectedPlayerForEvent.displayName} のプレー</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs sm:text-sm">
                  <div className="flex flex-col gap-1"><p className="font-bold text-gray-800">サーブ</p><button onClick={() => handleRecordEvent('serve', 'point')} className="bg-green-500 hover:bg-green-600 text-white p-2 rounded">得点</button><button onClick={() => handleRecordEvent('serve', 'success')} className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded">成功</button><button onClick={() => handleRecordEvent('serve', 'fail')} className="bg-red-500 hover:bg-red-600 text-white p-2 rounded">失点</button></div>
                  <div className="flex flex-col gap-1"><p className="font-bold text-gray-800">スパイク</p><button onClick={() => handleRecordEvent('spike', 'point')} className="bg-green-500 hover:bg-green-600 text-white p-2 rounded">得点</button><button onClick={() => handleRecordEvent('spike', 'success')} className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded">成功</button><button onClick={() => handleRecordEvent('spike', 'fail')} className="bg-red-500 hover:bg-red-600 text-white p-2 rounded">失点</button></div>
                  <div className="flex flex-col gap-1"><p className="font-bold text-gray-800">ブロック</p><button onClick={() => handleRecordEvent('block', 'point')} className="bg-green-500 hover:bg-green-600 text-white p-2 rounded">得点</button><button onClick={() => handleRecordEvent('block', 'success')} className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded">成功</button><button onClick={() => handleRecordEvent('block', 'fail')} className="bg-red-500 hover:bg-red-600 text-white p-2 rounded">失点</button></div>
                  <div className="flex flex-col gap-1"><p className="font-bold text-gray-800">ディグ</p><button onClick={() => handleRecordEvent('dig', 'success')} className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded">成功</button><button onClick={() => handleRecordEvent('dig', 'fail')} className="bg-red-500 hover:bg-red-600 text-white p-2 rounded">失敗</button></div>
                </div>
                <div className="grid grid-cols-1 mt-2"><div className="flex flex-col gap-1"><p className="font-bold text-gray-800 text-center">レセプション</p><div className="grid grid-cols-4 gap-1"><button onClick={() => handleRecordEvent('reception', 'a-pass')} className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded">A</button><button onClick={() => handleRecordEvent('reception', 'b-pass')} className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded">B</button><button onClick={() => handleRecordEvent('reception', 'c-pass')} className="bg-yellow-500 hover:bg-yellow-600 text-white p-2 rounded">C</button><button onClick={() => handleRecordEvent('reception', 'fail')} className="bg-red-500 hover:bg-red-600 text-white p-2 rounded">失点</button></div></div></div>
                <button onClick={() => setSelectedPlayerForEvent(null)} className="mt-4 w-full text-center text-sm text-gray-600 hover:text-black">キャンセル</button>
              </div>
            ) : (
              <div className="flex overflow-x-auto gap-3 pb-3">
                {activeSet.roster.map(member => { const p = players.find(p => p.id === member.playerId); if (!p) return null; return (<div key={member.playerId} onClick={() => handleSelectPlayerForEvent(member)} className={`flex-shrink-0 w-24 h-24 p-2 rounded-lg text-center flex flex-col justify-center cursor-pointer transition-colors ${member.position === 'L' ? 'bg-orange-100 hover:bg-orange-200' : 'bg-gray-200 hover:bg-gray-300'}`}><p className="font-bold text-gray-900">{p.displayName}</p><p className="text-sm text-gray-700">{member.position}</p></div>); })}
              </div>
            )}
          </div>
          <div className="p-4 border-t">
            <div className="flex justify-between items-center mb-2"><h3 className="font-semibold text-gray-800">直近のプレー</h3><button onClick={handleUndoEvent} disabled={events.length === 0} className="px-3 py-1 bg-yellow-500 text-white text-xs font-semibold rounded-md hover:bg-yellow-600 disabled:bg-gray-400">取り消し</button></div>
            {events.length === 0 ? <p className="text-sm text-gray-700">まだ記録がありません。</p> : (<ul className="space-y-1 text-sm text-gray-800">{events.slice(0, 5).map(e => { const p = e.playerId ? players.find(p => p.id === e.playerId) : null; const playerName = p ? p.displayName : e.type === 'opponent_error' ? '相手チーム' : '自チーム'; return (<li key={e.id} onClick={() => setEditingEvent(e)} className="cursor-pointer hover:bg-gray-200 p-1 rounded">{playerName}: {e.type.includes('_error') ? 'ミス' : `${e.type} - ${e.result}`}</li>); })}</ul>)}
          </div>
        </div>
      );
    }

    if (sets.length > 0 && !isSelectingForNextSet) {
      return (
        <div className="bg-white p-6 rounded-b-lg shadow-md">
          <div className="p-8 text-center">
            <h3 className="text-2xl font-bold mb-4 text-gray-800">セット間</h3>
            <div className="flex justify-center items-center gap-4">
              <button onClick={handleGoToNextSet} className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg text-lg">次のセットへ ({sets.length + 1})</button>
              <button onClick={handleFinishMatchManually} className="bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-6 rounded-lg text-lg">試合終了</button>
            </div>
            <div className="mt-8">
              <h4 className="text-lg font-semibold mb-2 text-gray-800">終了したセットの編集</h4>
              <ul className="space-y-2">{sets.map(set => (<li key={set.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-md">
                <span className="text-gray-800 font-medium">第{set.index}セット</span>
                <span className={`font-bold px-3 py-1 rounded-full text-sm ${set.score.own > set.score.opponent ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {set.score.own} - {set.score.opponent}
                </span>
                <div className="flex gap-2">
                  <button onClick={() => handleEditSetRoster(set)} className="px-3 py-1 bg-gray-500 text-white text-xs font-semibold rounded-md hover:bg-gray-600">選手</button>
                  <button onClick={() => handleReopenSet(set.id)} className="px-3 py-1 bg-green-500 text-white text-xs font-semibold rounded-md hover:bg-green-600">記録</button>
                </div>
              </li>))}</ul>
            </div>
          </div>
        </div>
      );
    }
    
    return renderRosterSelector();
  };
  
  return (
    <main className="min-h-screen bg-gray-100 p-2 sm:p-8">
      <div className="w-full max-w-5xl mx-auto">
        <header className="bg-white p-4 rounded-t-lg shadow-md border-b">
          <div className="flex justify-between items-center">
            <div><h1 className="text-2xl sm:text-3xl font-bold text-gray-900">vs {match.opponent}</h1><p className="text-sm text-gray-700">{new Date(match.matchDate.seconds * 1000).toLocaleString('ja-JP')}</p></div>
            <Link href="/dashboard"><span className="inline-block text-sm text-blue-600 hover:text-blue-800">&larr; ダッシュボードに戻る</span></Link>
          </div>
          {isMatchFinished && <div className="mt-4 p-4 bg-yellow-100 text-yellow-800 rounded-lg text-center font-semibold">この試合は終了しています。記録は編集モードです。</div>}
        </header>
        {renderContent()}
        {isSubModalOpen && activeSet && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center p-4">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
              <h2 className="text-2xl font-bold mb-4 text-gray-800">選手交代</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">OUT (コートから退く選手)</label>
                  <select value={subOutPlayer} onChange={(e) => setSubOutPlayer(e.target.value)} className="w-full border border-gray-300 p-2 rounded-md text-gray-900">
                    <option value="">選択してください</option>
                    {activeSet.roster.map(member => { const player = players.find(p => p.id === member.playerId); return <option key={member.playerId} value={member.playerId}>{player?.displayName}</option> })}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">IN (コートに入る選手)</label>
                  <select value={subInPlayer} onChange={(e) => setSubInPlayer(e.target.value)} className="w-full border border-gray-300 p-2 rounded-md text-gray-900">
                    <option value="">選択してください</option>
                    {benchPlayers.map(player => (<option key={player.id} value={player.id}>{player.displayName}</option>))}
                  </select>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-4">
                <button onClick={() => setIsSubModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">キャンセル</button>
                <button onClick={handleSubstitution} className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">交代する</button>
              </div>
            </div>
          </div>
        )}
        {editingEvent && activeSet && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center p-4">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
              <h2 className="text-2xl font-bold mb-4">プレー記録を編集</h2>
              <p className="mb-2"><strong>選手:</strong> {players.find(p => p.id === editingEvent.playerId)?.displayName || 'チームプレー'}</p>
              <p className="mb-2"><strong>プレー:</strong> {editingEvent.type}</p>
              <p className="mb-4"><strong>結果:</strong> {editingEvent.result}</p>
              <p className="text-xs text-gray-600 mb-4">現在、この記録の削除のみ可能です。</p>
              <div className="mt-6 flex justify-between items-center">
                <button onClick={handleDeleteEvent} className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600">この記録を削除</button>
                <button onClick={() => setEditingEvent(null)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">閉じる</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}