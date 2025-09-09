"use client";
import { useState, useEffect, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useFirebase } from '@/app/FirebaseProvider';
import { doc, getDoc, collection, getDocs, query, where, writeBatch, serverTimestamp, Timestamp, runTransaction, onSnapshot, updateDoc, orderBy, deleteDoc, addDoc } from 'firebase/firestore';

// --- 型定義 ---
interface Player {
  id: string;
  displayName: string;
}
interface Match {
  id: string;
  opponent: string;
  status: 'scheduled' | 'ongoing' | 'finished';
}
interface Set {
  id: string;
  setNumber: number;
  ourScore: number;
  opponentScore: number;
  status: 'pending' | 'ongoing' | 'finished';
  roster: RosterPlayer[];
}
interface RosterPlayer {
  playerId: string;
  displayName: string;
  position: string;
}
// *** MODIFIED ***: ActionTypeを使用
interface Event {
  id: string;
  action: ActionType | string; // チームプレーを考慮し、stringも許容
  result: string;
  playerId: string;
  playerName: string;
  position: string;
  createdAt: Timestamp;
}
// *** MODIFIED ***: ActionTypeを使用
interface EditingEvent {
  id: string;
  player: Player;
  action: ActionType;
  result: string;
}

// --- 定数定義 ---
const POSITIONS = ["S", "OH", "OP", "MB", "L", "SUB"];

// *** MODIFIED ***: `as const` を追加して型を厳密にする
const ACTIONS = {
  SERVE: "サーブ",
  SPIKE: "スパイク",
  BLOCK: "ブロック",
  DIG: "ディグ",
  RECEPTION: "レセプション",
} as const;

// *** NEW ***: `ACTIONS`オブジェクトの値から型を生成
type ActionType = typeof ACTIONS[keyof typeof ACTIONS];

// *** MODIFIED ***: `RESULTS`オブジェクトに厳密な型を定義
const RESULTS: Record<ActionType, string[]> = {
  "サーブ": ["得点", "成功", "失点"],
  "スパイク": ["得点", "成功", "失点"],
  "ブロック": ["得点", "成功", "失点"],
  "ディグ": ["成功", "失敗"],
  "レセプション": ["Aパス", "Bパス", "Cパス", "失点"],
};

const TEAM_ACTIONS = {
  OPPONENT_ERROR: "相手のミス（自チーム得点）",
  OUR_ERROR: "こちらのミス（相手チーム失点）",
};

export default function MatchPage() {
  const { db, teamInfo } = useFirebase();
  const router = useRouter();
  const pathname = usePathname();
  const matchId = pathname.split('/')[2] || '';

  const [match, setMatch] = useState<Match | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [sets, setSets] = useState<Set[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State Management
  const [activeSet, setActiveSet] = useState<Set | null>(null);
  const [viewingSet, setViewingSet] = useState<Set | null>(null);

  // Modal States
  const [isRosterModalOpen, setIsRosterModalOpen] = useState(false);
  const [roster, setRoster] = useState<Map<string, RosterPlayer>>(new Map());
  const [selectedPlayer, setSelectedPlayer] = useState<RosterPlayer | null>(null);
  
  // *** MODIFIED ***: stringからActionTypeへ
  const [selectedAction, setSelectedAction] = useState<ActionType | null>(null);
  
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EditingEvent | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAllEventsModalOpen, setIsAllEventsModalOpen] = useState(false);
  
  // Substitution Modal States
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [playerOutId, setPlayerOutId] = useState<string>('');
  const [playerInId, setPlayerInId] = useState<string>('');

  // --- データ取得 Hooks (変更なし) ---
  useEffect(() => {
    if (!db || !matchId || !teamInfo?.id) return;
    const teamId = teamInfo.id;
    let matchUnsubscribe: (() => void) | undefined;
    
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        const matchRef = doc(db, `teams/${teamId}/matches/${matchId}`);
        matchUnsubscribe = onSnapshot(matchRef, (docSnap) => {
          if (docSnap.exists()) { setMatch({ id: docSnap.id, ...docSnap.data() } as Match); } else { setError("試合が見つかりません。"); }
        });
        const playersRef = collection(db, `teams/${teamId}/players`);
        const playersSnap = await getDocs(playersRef);
        setPlayers(playersSnap.docs.map(d => ({ ...d.data(), id: d.id } as Player)));
      } catch (err) { console.error(err); setError("データの読み込みに失敗しました。"); } 
      finally { setLoading(false); }
    };
    fetchInitialData();
    return () => { if (matchUnsubscribe) matchUnsubscribe(); }
  }, [db, matchId, teamInfo]);

  useEffect(() => {
    if (!teamInfo?.id || !matchId) return;
    const teamId = teamInfo.id;
    const setsRef = collection(db, `teams/${teamId}/matches/${matchId}/sets`);
    const q = query(setsRef, orderBy('setNumber', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const setsData = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Set));
      setSets(setsData);
      const ongoingSet = setsData.find(s => s.status === 'ongoing') || null;
      setActiveSet(ongoingSet);
      if (ongoingSet) { setViewingSet(ongoingSet); } 
      else if (setsData.length > 0 && !viewingSet) { setViewingSet(setsData[setsData.length-1]); } 
      else if (setsData.some(s => s.id === viewingSet?.id)) { setViewingSet(current => setsData.find(s => s.id === current?.id) || null); }
    }, (err) => { console.error("セット情報の取得に失敗:", err); setError("セット情報の取得に失敗しました。"); });
    return () => unsubscribe();
  }, [teamInfo, db, matchId]);

  useEffect(() => {
    if (!viewingSet || !teamInfo?.id || !matchId) { setEvents([]); return; }
    const teamId = teamInfo.id;
    const eventsRef = collection(db, `teams/${teamId}/matches/${matchId}/sets/${viewingSet.id}/events`);
    const q = query(eventsRef, orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setEvents(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Event)));
    }, (err) => { console.error("プレー履歴の取得に失敗:", err); setError("プレー履歴の取得に失敗しました。"); });
    return () => unsubscribe();
  }, [viewingSet, teamInfo, db, matchId]);
  
  // --- スコア計算ロジック (変更なし) ---
  const calculateScoreChange = (action: string, result: string) => {
    let scoreChangeOur = 0, scoreChangeOpponent = 0;
    if (action === TEAM_ACTIONS.OPPONENT_ERROR) scoreChangeOur = 1;
    else if (action === TEAM_ACTIONS.OUR_ERROR) scoreChangeOpponent = 1;
    else if (result === "得点") scoreChangeOur = 1;
    else if (result === "失点" || result === "失敗") scoreChangeOpponent = 1;
    return { scoreChangeOur, scoreChangeOpponent };
  };

  // --- ハンドラ関数 (ロジックは変更なし) ---
  const handleOpenRosterModal = (setForRoster?: Set) => {
    if (setForRoster) {
        const initialRoster = new Map<string, RosterPlayer>();
        setForRoster.roster.forEach(p => initialRoster.set(p.playerId, p));
        setRoster(initialRoster);
    } else { setRoster(new Map()); }
    setIsRosterModalOpen(true);
  };
  const handleCloseRosterModal = () => setIsRosterModalOpen(false);
  const handleRosterChange = (playerId: string, displayName: string, position: string) => {
    setRoster(prev => {
      const newRoster = new Map(prev);
      if (position === "SUB" || !position) newRoster.delete(playerId);
      else newRoster.set(playerId, { playerId, displayName, position });
      return newRoster;
    });
  };
  const handleUpdateRoster = async () => {
    if (!viewingSet || roster.size < 1) { alert("少なくとも1人の選手をポジションに設定してください。"); return; }
    const teamId = teamInfo!.id;
    const setRef = doc(db, `teams/${teamId}/matches/${matchId}/sets/${viewingSet.id}`);
    try { await updateDoc(setRef, { roster: Array.from(roster.values()), updatedAt: serverTimestamp() }); alert("ロスターを更新しました。"); handleCloseRosterModal(); } 
    catch(err) { console.error(err); setError("ロスターの更新に失敗しました。"); }
  };
  const handleStartSet = async () => {
    if (!teamInfo?.id || !matchId) return;
    if (roster.size < 1) { alert("少なくとも1人の選手をポジションに設定してください。"); return; }
    setLoading(true);
    const teamId = teamInfo.id;
    const nextSetNumber = sets.length + 1;
    try {
      const matchRef = doc(db, `teams/${teamId}/matches/${matchId}`);
      const setsRef = collection(matchRef, 'sets');
      await runTransaction(db, async (t) => {
        const q = query(setsRef, where("status", "==", "ongoing"));
        const ongoingSnap = await getDocs(q);
        ongoingSnap.forEach(setDoc => t.update(setDoc.ref, { status: 'finished' }));
        const newSetRef = doc(setsRef);
        t.set(newSetRef, { setNumber: nextSetNumber, ourScore: 0, opponentScore: 0, status: 'ongoing', roster: Array.from(roster.values()), createdAt: serverTimestamp(), });
        t.update(matchRef, { status: 'ongoing' });
      });
      handleCloseRosterModal();
    } catch (err) { console.error(err); setError("セットの開始に失敗しました。"); } 
    finally { setLoading(false); }
  };
  const handleFinishSet = async () => {
    if (!teamInfo?.id || !matchId || !activeSet) return;
    if (!window.confirm("このセットを終了しますか？")) return;
    const teamId = teamInfo.id;
    const setRef = doc(db, `teams/${teamId}/matches/${matchId}/sets/${activeSet.id}`);
    try { await updateDoc(setRef, { status: 'finished', updatedAt: serverTimestamp() }); } 
    catch (err) { console.error(err); setError("セットの終了処理に失敗しました。"); }
  };
  const handlePlayerTileClick = (player: RosterPlayer) => { setSelectedPlayer(player); setIsActionModalOpen(true); };
  const handleCloseActionModal = () => { setSelectedPlayer(null); setSelectedAction(null); setIsActionModalOpen(false); };
  const handleRecordEvent = async (result: string) => {
    if (!teamInfo?.id || !matchId || !viewingSet || !selectedPlayer || !selectedAction) return;
    const teamId = teamInfo.id;
    const setRef = doc(db, `teams/${teamId}/matches/${matchId}/sets/${viewingSet.id}`);
    try {
      const { scoreChangeOur, scoreChangeOpponent } = calculateScoreChange(selectedAction, result);
      await runTransaction(db, async (t) => {
        const setDoc = await t.get(setRef);
        if (!setDoc.exists()) throw new Error("Set does not exist!");
        const currentOurScore = setDoc.data().ourScore || 0;
        const newEventRef = doc(collection(setRef, 'events'));
        t.set(newEventRef, { playerId: selectedPlayer.playerId, playerName: selectedPlayer.displayName, position: selectedPlayer.position, action: selectedAction, result: result, createdAt: serverTimestamp(), ourScore_at_event: currentOurScore + scoreChangeOur, opponentScore_at_event: (setDoc.data().opponentScore || 0) + scoreChangeOpponent, });
        t.update(setRef, { ourScore: currentOurScore + scoreChangeOur, opponentScore: (setDoc.data().opponentScore || 0) + scoreChangeOpponent, updatedAt: serverTimestamp(), });
      });
    } catch (err) { console.error(err); setError("記録の保存に失敗しました。"); } 
    finally { handleCloseActionModal(); }
  };
  const handleRecordTeamEvent = async (action: string) => {
    if (!teamInfo?.id || !matchId || !viewingSet) return;
    const teamId = teamInfo.id;
    const setRef = doc(db, `teams/${teamId}/matches/${matchId}/sets/${viewingSet.id}`);
    try {
      const { scoreChangeOur, scoreChangeOpponent } = calculateScoreChange(action, "");
      await runTransaction(db, async (t) => {
        const setDoc = await t.get(setRef);
        if (!setDoc.exists()) throw new Error("Set does not exist!");
        const newEventRef = doc(collection(setRef, 'events'));
        t.set(newEventRef, { playerId: null, playerName: "チーム", position: null, action: action, result: "", createdAt: serverTimestamp(), ourScore_at_event: (setDoc.data().ourScore || 0) + scoreChangeOur, opponentScore_at_event: (setDoc.data().opponentScore || 0) + scoreChangeOpponent, });
        t.update(setRef, { ourScore: (setDoc.data().ourScore || 0) + scoreChangeOur, opponentScore: (setDoc.data().opponentScore || 0) + scoreChangeOpponent, updatedAt: serverTimestamp(), });
      });
    } catch (err) { console.error(err); setError("チームプレーの記録に失敗しました。"); }
  };
  const handleUndoEvent = async () => { if (!events || events.length === 0 || !viewingSet) return; await handleDeleteSpecificEvent(events[0].id, false); };
  const handleOpenEditModal = (event: Event) => {
    if (!event.playerId || !Object.values(ACTIONS).includes(event.action as ActionType)) { alert("チームに関するプレーは、ここから編集できません。"); return; }
    const player = players.find(p => p.id === event.playerId);
    if (player) {
      setEditingEvent({ id: event.id, player, action: event.action as ActionType, result: event.result });
      setIsEditModalOpen(true);
      setIsAllEventsModalOpen(false);
    } else { setError("編集対象の選手が見つかりません。"); }
  };
  const handleCloseEditModal = () => { setEditingEvent(null); setIsEditModalOpen(false); };
  const handleDeleteSpecificEvent = async (eventIdToDelete: string, shouldConfirm: boolean = true) => {
    if (!teamInfo?.id || !matchId || !viewingSet) return;
    if (shouldConfirm && !window.confirm("このプレー記録を削除しますか？")) return;
    const teamId = teamInfo.id;
    const setRef = doc(db, `teams/${teamId}/matches/${matchId}/sets/${viewingSet.id}`);
    const eventToDeleteRef = doc(collection(setRef, 'events'), eventIdToDelete);
    try {
      await runTransaction(db, async (t) => {
        const allEventsQuery = query(collection(setRef, 'events'), orderBy('createdAt', 'asc'));
        const allEventsSnap = await getDocs(allEventsQuery);
        let newOurScore = 0, newOpponentScore = 0;
        allEventsSnap.docs.filter(d => d.id !== eventIdToDelete).forEach(doc => { const { scoreChangeOur, scoreChangeOpponent } = calculateScoreChange(doc.data().action, doc.data().result); newOurScore += scoreChangeOur; newOpponentScore += scoreChangeOpponent; });
        t.delete(eventToDeleteRef);
        t.update(setRef, { ourScore: newOurScore, opponentScore: newOpponentScore });
      });
      if (isAllEventsModalOpen) closeAllEventsModal();
      if (isEditModalOpen) handleCloseEditModal();
    } catch (error) { console.error(error); setError("プレーの削除に失敗しました。"); }
  };
  const handleUpdateEvent = async () => {
    if (!editingEvent || !teamInfo?.id || !matchId || !viewingSet) return;
    const teamId = teamInfo.id;
    const setRef = doc(db, `teams/${teamId}/matches/${matchId}/sets/${viewingSet.id}`);
    const eventToUpdateRef = doc(collection(setRef, 'events'), editingEvent.id);
    try {
      await runTransaction(db, async (t) => {
        const allEventsQuery = query(collection(setRef, 'events'), orderBy('createdAt', 'asc'));
        const allEventsSnap = await getDocs(allEventsQuery);
        let newOurScore = 0, newOpponentScore = 0;
        allEventsSnap.docs.forEach(doc => {
            let eventData = doc.data();
            if (doc.id === editingEvent.id) eventData = { ...eventData, playerId: editingEvent.player.id, playerName: editingEvent.player.displayName, action: editingEvent.action, result: editingEvent.result };
            const { scoreChangeOur, scoreChangeOpponent } = calculateScoreChange(eventData.action, eventData.result);
            newOurScore += scoreChangeOur; newOpponentScore += scoreChangeOpponent;
        });
        t.update(eventToUpdateRef, { playerId: editingEvent.player.id, playerName: editingEvent.player.displayName, action: editingEvent.action, result: editingEvent.result, updatedAt: serverTimestamp(), });
        t.update(setRef, { ourScore: newOurScore, opponentScore: newOpponentScore });
      });
      handleCloseEditModal();
    } catch (error) { console.error(error); setError("プレーの更新に失敗しました。"); }
  };
  const openAllEventsModal = () => setIsAllEventsModalOpen(true);
  const closeAllEventsModal = () => setIsAllEventsModalOpen(false);
  const openSubModal = () => { setPlayerInId(''); setPlayerOutId(''); setIsSubModalOpen(true); };
  const closeSubModal = () => setIsSubModalOpen(false);
  const handleSubstitutePlayer = async () => {
    if (!playerInId || !playerOutId || !activeSet || !teamInfo?.id) { alert("交代する選手を両方選択してください。"); return; }
    const teamId = teamInfo.id;
    const setRef = doc(db, `teams/${teamId}/matches/${matchId}/sets/${activeSet.id}`);
    const playerInObject = players.find(p => p.id === playerInId);
    if (!playerInObject) { setError("交代加入する選手の情報が見つかりません。"); return; }
    const newRoster = activeSet.roster.map(rosterPlayer => { if (rosterPlayer.playerId === playerOutId) { return { ...rosterPlayer, playerId: playerInObject.id, displayName: playerInObject.displayName }; } return rosterPlayer; });
    try { await updateDoc(setRef, { roster: newRoster, updatedAt: serverTimestamp() }); closeSubModal(); } 
    catch (err) { console.error("選手交代の処理に失敗しました:", err); setError("選手交代の処理に失敗しました。"); }
  };

  // --- Memoized Calculations (変更なし) ---
  const subPlayers = useMemo(() => {
    if (!viewingSet) return [];
    const onCourtIds = new Set(viewingSet.roster.map(p => p.playerId));
    return players.filter(p => !onCourtIds.has(p.id));
  }, [viewingSet, players]);
  
  // --- Helper Functions (for styling, 変更なし) ---
  const getActionButtonClass = (a:ActionType) => a.match(/スパイク|サーブ|ブロック/) ? "bg-blue-600 hover:bg-blue-700" : "bg-teal-600 hover:bg-teal-700";
  const getResultButtonClass = (r:string) => r.match(/得点/) ? "bg-green-600" : r.match(/成功|Aパス|Bパス/) ? "bg-sky-600" : "bg-red-600";
  
  // --- Rendering ---
  if (loading) return <div className="flex min-h-screen items-center justify-center bg-gray-100"><p>試合データを読み込んでいます...</p></div>;
  if (error) return <div className="flex min-h-screen items-center justify-center bg-gray-100"><p className="text-red-500 max-w-md text-center">エラー: {error}</p></div>;
  if (!match) return <div className="flex min-h-screen items-center justify-center bg-gray-100"><p>試合が見つかりません。</p></div>;

  return (
    <main className="min-h-screen bg-gray-100 p-2 sm:p-8">
      <div className="w-full max-w-5xl mx-auto">
        {/* Header and Set Tabs (変更なし) */}
        <header className="bg-white p-4 rounded-lg shadow-md mb-4"><div className="flex justify-between items-center"><div><h1 className="text-2xl sm:text-3xl font-bold text-gray-900">vs {match.opponent}</h1><p className="text-base text-gray-700 font-medium mt-1">{sets.map(s => `${s.ourScore}-${s.opponentScore}`).join(' / ')}</p></div><div className="flex items-center gap-3"><Link href={`/matches/${matchId}/summary`}><span className="px-4 py-2 bg-gray-600 text-white text-base font-bold rounded-md hover:bg-gray-700">集計</span></Link><Link href="/dashboard"><span className="px-4 py-2 bg-blue-600 text-white text-base font-bold rounded-md hover:bg-blue-700">ダッシュボード</span></Link></div></div></header>
        <div className="flex items-center gap-2 mb-4 p-2 bg-white rounded-lg shadow-md overflow-x-auto">{sets.map(s => (<button key={s.id} onClick={() => setViewingSet(s)} className={`px-4 py-2 rounded-md font-bold text-sm whitespace-nowrap ${viewingSet?.id === s.id ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}>Set {s.setNumber} {s.status === 'ongoing' ? ' (記録中)' : ''}</button>))}
          {!activeSet && (<button onClick={() => handleOpenRosterModal()} className="px-4 py-2 rounded-md font-bold text-sm bg-green-500 text-white hover:bg-green-600 whitespace-nowrap">＋ 次のセット</button>)}
        </div>

        {/* Viewing Area (変更なし) */}
        {viewingSet ? (<div className="grid grid-cols-1 md:grid-cols-3 gap-6"><div className="md:col-span-2 space-y-6"><div className="bg-white p-4 rounded-lg shadow-md flex justify-around items-center"><div className="text-center"><p className="text-xl font-bold text-gray-800">自チーム</p><p className="text-6xl font-bold text-blue-600 tracking-tighter">{viewingSet.ourScore}</p></div><div className="text-center"><p className="text-xl font-bold text-gray-800">Set {viewingSet.setNumber}</p><div className="flex flex-wrap justify-center gap-2 mt-2"><button onClick={openAllEventsModal} className="px-3 py-2 bg-gray-200 text-gray-900 text-sm font-bold rounded-md hover:bg-gray-300">全履歴</button>{viewingSet.status === 'ongoing' && <> <button onClick={handleUndoEvent} className="px-3 py-2 bg-yellow-600 text-white text-sm font-bold rounded-md hover:bg-yellow-700">取消</button> <button onClick={openSubModal} className="px-3 py-2 bg-green-600 text-white text-sm font-bold rounded-md hover:bg-green-700">選手交代</button> <button onClick={handleFinishSet} className="px-3 py-2 bg-red-600 text-white text-sm font-bold rounded-md hover:bg-red-700">セット終了</button> </>} {viewingSet.status === 'finished' && <button onClick={() => handleOpenRosterModal(viewingSet)} className="px-3 py-2 bg-purple-600 text-white text-sm font-bold rounded-md hover:bg-purple-700">ロスター編集</button>}</div></div><div className="text-center"><p className="text-xl font-bold text-gray-800">相手チーム</p><p className="text-6xl font-bold text-red-600 tracking-tighter">{viewingSet.opponentScore}</p></div></div>
        {viewingSet.status === 'ongoing' ? (<> <div className="grid grid-cols-3 sm:grid-cols-3 gap-4">{viewingSet.roster.filter(p => p.position !== 'SUB').map(player => (<div key={player.playerId} onClick={() => handlePlayerTileClick(player)} className="bg-white p-4 rounded-lg shadow-md text-center cursor-pointer hover:bg-blue-50"><p className="font-bold text-xl text-gray-900">{player.displayName}</p><p className="text-base text-blue-800 font-semibold">{player.position}</p></div>))}</div><div className="grid grid-cols-2 gap-4"><button onClick={() => handleRecordTeamEvent(TEAM_ACTIONS.OPPONENT_ERROR)} className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-lg shadow-md text-lg">相手のミス</button><button onClick={() => handleRecordTeamEvent(TEAM_ACTIONS.OUR_ERROR)} className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-4 rounded-lg shadow-md text-lg">こちらのミス</button></div> </>) : (<div className="bg-white p-4 rounded-lg shadow-md"><h3 className="text-xl font-bold text-center text-gray-800 mb-2">このセットは終了しました</h3><p className="text-center text-gray-600">プレーを編集するには「全履歴」から操作してください。</p></div>)}</div><div className="bg-white p-4 rounded-lg shadow-md"><h2 className="text-xl font-semibold mb-4 text-gray-800">プレー履歴 (Set {viewingSet.setNumber})</h2><ul className="space-y-3">{events.map((event) => (<li key={event.id} onClick={() => handleOpenEditModal(event)} className="p-3 rounded-md hover:bg-gray-100 cursor-pointer border-b"><p className="font-semibold text-base text-gray-800">{event.playerName}: <span className="font-medium text-gray-700">{event.action} - {event.result}</span></p><p className="text-sm text-gray-600 mt-1">{event.createdAt?.toDate().toLocaleTimeString()}</p></li>))}</ul></div></div>) : 
        (<div className="text-center bg-white p-10 rounded-lg shadow-md"><h2 className="text-3xl font-bold text-gray-800 mb-4">最初のセットを開始</h2><p className="text-gray-700 mb-8 text-lg">出場する選手とポジションを選択してください。</p><button onClick={() => handleOpenRosterModal()} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-lg shadow-md text-lg">ロスターを選択してセット開始</button></div>)}
      </div>

      {/* --- Modals --- */}
      {isRosterModalOpen && (<div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center p-4"><div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-lg"><h2 className="text-2xl font-bold mb-6 text-gray-900">{viewingSet && viewingSet.status === 'finished' ? `Set ${viewingSet.setNumber} のロスターを編集` : "スターティングメンバー選択"}</h2><div className="space-y-4 max-h-96 overflow-y-auto">{players.map(p => (<div key={p.id} className="flex items-center justify-between border-b pb-3"><span className="text-lg text-gray-900 font-medium">{p.displayName}</span><select value={roster.get(p.id)?.position || 'SUB'} onChange={(e) => handleRosterChange(p.id, p.displayName, e.target.value)} className="border p-2 rounded-md text-base"><option value="SUB">控え</option>{POSITIONS.filter(pos => pos !== 'SUB').map(pos => <option key={pos} value={pos}>{pos}</option>)}</select></div>))}</div><div className="flex justify-end gap-4 mt-8"><button onClick={handleCloseRosterModal} className="px-6 py-3 bg-gray-200 text-gray-900 font-bold rounded-md hover:bg-gray-300">キャンセル</button>{viewingSet && viewingSet.status === 'finished' ? <button onClick={handleUpdateRoster} className="px-6 py-3 bg-purple-600 text-white font-bold rounded-md hover:bg-purple-700">ロスターを更新</button> : <button onClick={handleStartSet} className="px-6 py-3 bg-blue-600 text-white font-bold rounded-md hover:bg-blue-700">セット開始</button>}</div></div></div>)}
      
      {/* *** MODIFIED ***: `as any` を削除 */}
      {isActionModalOpen && selectedPlayer && (<div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center p-4"><div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md"><h2 className="text-2xl font-bold mb-6 text-gray-900">{selectedPlayer.displayName}のプレー</h2>{!selectedAction ? (<div className="grid grid-cols-2 gap-4">{Object.values(ACTIONS).map(a => (<button key={a} onClick={() => setSelectedAction(a)} className={`p-4 rounded-md font-bold text-lg text-white shadow-md ${getActionButtonClass(a)}`}>{a}</button>))}</div>) : (<div><h3 className="text-xl font-semibold mb-4 text-gray-800">{selectedAction}</h3><div className="flex flex-col gap-3">{RESULTS[selectedAction].map((r) => (<button key={r} onClick={() => handleRecordEvent(r)} className={`p-4 rounded-md font-bold text-lg text-white shadow-md ${getResultButtonClass(r)} hover:opacity-90`}>{r}</button>))}</div><button onClick={() => setSelectedAction(null)} className="mt-6 text-sm text-gray-700 hover:underline">← プレー選択に戻る</button></div>)}<button onClick={handleCloseActionModal} className="w-full mt-8 px-4 py-3 bg-gray-500 text-white font-bold rounded-md hover:bg-gray-600">閉じる</button></div></div>)}
      
      {/* *** MODIFIED ***: `as any` を削除 */}
      {isEditModalOpen && editingEvent && (<div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center p-4"><div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md"><h2 className="text-2xl font-bold mb-6 text-gray-900">プレーを編集</h2><div className="space-y-5"><div><label className="block text-base font-medium text-gray-700">選手</label><select value={editingEvent.player.id} onChange={(e) => setEditingEvent({ ...editingEvent, player: players.find(p => p.id === e.target.value)! })} className="w-full mt-1 border p-3 rounded-md text-base">{players.map(p => <option key={p.id} value={p.id}>{p.displayName}</option>)}</select></div><div><label className="block text-base font-medium text-gray-700">プレー</label><select value={editingEvent.action} onChange={(e) => setEditingEvent({...editingEvent, action: e.target.value as ActionType, result: RESULTS[e.target.value as ActionType][0]})} className="w-full mt-1 border p-3 rounded-md text-base">{Object.values(ACTIONS).map(a => <option key={a} value={a}>{a}</option>)}</select></div><div><label className="block text-base font-medium text-gray-700">結果</label><select value={editingEvent.result} onChange={(e) => setEditingEvent({ ...editingEvent, result: e.target.value })} className="w-full mt-1 border p-3 rounded-md text-base">{RESULTS[editingEvent.action].map((r) => <option key={r} value={r}>{r}</option>)}</select></div></div><div className="flex justify-between items-center mt-8"><button onClick={() => handleDeleteSpecificEvent(editingEvent.id)} className="px-5 py-3 bg-red-600 text-white font-bold rounded-md hover:bg-red-700">このプレーを削除</button><div className="flex gap-4"><button type="button" onClick={handleCloseEditModal} className="px-5 py-3 bg-gray-200 text-gray-900 font-bold rounded-md hover:bg-gray-300">キャンセル</button><button onClick={handleUpdateEvent} className="px-5 py-3 bg-blue-600 text-white font-bold rounded-md hover:bg-blue-700">更新</button></div></div></div></div>)}
      
      {isAllEventsModalOpen && (<div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center p-4"><div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl"><div className="flex justify-between items-center mb-4"><h2 className="text-2xl font-bold text-gray-900">Set {viewingSet?.setNumber} の全プレー履歴</h2><button onClick={closeAllEventsModal} className="text-3xl font-light text-gray-700 hover:text-black">&times;</button></div><div className="max-h-[70vh] overflow-y-auto"><ul className="divide-y divide-gray-200">{events.map((event) => (<li key={event.id} className="py-4 px-2 flex justify-between items-center"><div><p className="text-base font-medium text-gray-800">{event.playerName}: <span className="font-normal text-gray-700">{event.action} - {event.result || 'N/A'}</span></p><p className="text-sm text-gray-600 mt-1">{event.createdAt?.toDate().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</p></div><div className="flex gap-2"><button onClick={() => handleOpenEditModal(event)} className="px-4 py-2 bg-yellow-600 text-white text-sm font-bold rounded-md hover:bg-yellow-700">編集</button><button onClick={() => handleDeleteSpecificEvent(event.id)} className="px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-md hover:bg-red-700">削除</button></div></li>))}</ul></div></div></div>)}
      
      {/* Substitution Modal (変更なし) */}
      {isSubModalOpen && activeSet && (<div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center p-4"><div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md"><h2 className="text-2xl font-bold mb-6 text-gray-900">選手交代</h2><div className="space-y-5"><div><label htmlFor="player-out" className="block text-base font-medium text-gray-700">コートから退く選手</label><select id="player-out" value={playerOutId} onChange={(e) => setPlayerOutId(e.target.value)} className="w-full mt-1 border p-3 rounded-md text-base"><option value="" disabled>選択してください</option>{activeSet.roster.map(p => (<option key={p.playerId} value={p.playerId}>{p.displayName} ({p.position})</option>))}</select></div><div><label htmlFor="player-in" className="block text-base font-medium text-gray-700">コートに入る選手</label><select id="player-in" value={playerInId} onChange={(e) => setPlayerInId(e.target.value)} className="w-full mt-1 border p-3 rounded-md text-base"><option value="" disabled>選択してください</option>{subPlayers.map(p => (<option key={p.id} value={p.id}>{p.displayName}</option>))}</select></div></div><div className="flex justify-end gap-4 mt-8"><button onClick={closeSubModal} className="px-6 py-3 bg-gray-200 text-gray-900 font-bold rounded-md hover:bg-gray-300">キャンセル</button><button onClick={handleSubstitutePlayer} className="px-6 py-3 bg-green-600 text-white font-bold rounded-md hover:bg-green-700">交代を実行</button></div></div></div>)}
    </main>
  );
}