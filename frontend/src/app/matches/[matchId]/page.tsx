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
interface Event {
  id: string;
  action: string;
  result: string;
  playerId: string;
  playerName: string;
  position: string;
  createdAt: Timestamp;
}
interface EditingEvent {
  id: string;
  player: Player;
  action: string;
  result: string;
}

// --- 定数定義 ---
const POSITIONS = ["S", "OH", "OP", "MB", "L", "SUB"];
const ACTIONS = {
  SERVE: "サーブ",
  SPIKE: "スパイク",
  BLOCK: "ブロック",
  DIG: "ディグ",
  RECEPTION: "レセプション",
};
const RESULTS: Record<string, string[]> = {
  [ACTIONS.SERVE]: ["得点", "成功", "失点"],
  [ACTIONS.SPIKE]: ["得点", "成功", "失点"],
  [ACTIONS.BLOCK]: ["得点", "成功", "失点"],
  [ACTIONS.DIG]: ["成功", "失敗"],
  [ACTIONS.RECEPTION]: ["Aパス", "Bパス", "Cパス", "失点"],
};
const TEAM_ACTIONS = {
  OPPONENT_ERROR: "得点（自チーム得点）",
  OUR_ERROR: "失点（相手チーム失点）",
};

export default function MatchPage() {
  const { db, teamInfo } = useFirebase();
  const router = useRouter();
  const pathname = usePathname();
  const matchId = pathname.split('/')[2] || '';

  const [match, setMatch] = useState<Match | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [sets, setSets] = useState<Set[]>([]);
  const [activeSet, setActiveSet] = useState<Set | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Roster Management State
  const [isRosterModalOpen, setIsRosterModalOpen] = useState(false);
  const [roster, setRoster] = useState<Map<string, RosterPlayer>>(new Map());

  // Event Recording State
  const [selectedPlayer, setSelectedPlayer] = useState<RosterPlayer | null>(null);
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);

  // Event Editing State
  const [editingEvent, setEditingEvent] = useState<EditingEvent | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  // *** NEW ***: State for all events history modal
  const [isAllEventsModalOpen, setIsAllEventsModalOpen] = useState(false);

  // --- データ取得 Hooks ---
  useEffect(() => {
    if (!db || !matchId || !teamInfo?.id) return;
    const teamId = teamInfo.id;
    let matchUnsubscribe: (() => void) | undefined;
    
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        const matchRef = doc(db, `teams/${teamId}/matches/${matchId}`);
        matchUnsubscribe = onSnapshot(matchRef, (docSnap) => {
          if (docSnap.exists()) {
            setMatch({ id: docSnap.id, ...docSnap.data() } as Match);
          } else {
            setError("試合が見つかりません。");
          }
        });

        const playersRef = collection(db, `teams/${teamId}/players`);
        const playersSnap = await getDocs(playersRef);
        setPlayers(playersSnap.docs.map(d => ({ ...d.data(), id: d.id } as Player)));

      } catch (err) {
        console.error(err);
        setError("データの読み込みに失敗しました。");
      } finally {
        setLoading(false);
      }
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
      if (!ongoingSet && setsData.length > 0 && !isRosterModalOpen) {
         // 進行中のセットがない場合は、最後のセットを表示状態にする（任意）
      }
    }, (err) => {
      console.error("セット情報の取得に失敗:", err);
      setError("セット情報の取得に失敗しました。");
    });

    return () => unsubscribe();
  }, [teamInfo, db, matchId, isRosterModalOpen]);

  useEffect(() => {
    if (!activeSet || !teamInfo?.id || !matchId) {
      setEvents([]);
      return;
    }
    const teamId = teamInfo.id;
    const eventsRef = collection(db, `teams/${teamId}/matches/${matchId}/sets/${activeSet.id}/events`);
    const q = query(eventsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setEvents(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Event)));
    }, (err) => {
      console.error("プレー履歴の取得に失敗:", err);
      setError("プレー履歴の取得に失敗しました。");
    });

    return () => unsubscribe();
  }, [activeSet, teamInfo, db, matchId]);
  

  // --- スコア計算ロジック ---
  const calculateScoreChange = (action: string, result: string) => {
    let scoreChangeOur = 0;
    let scoreChangeOpponent = 0;

    if (action === TEAM_ACTIONS.OPPONENT_ERROR) {
      scoreChangeOur = 1;
    } else if (action === TEAM_ACTIONS.OUR_ERROR) {
      scoreChangeOpponent = 1;
    } else if (result === "得点") {
      scoreChangeOur = 1;
    } else if (result === "失点" || result === "失敗") {
      scoreChangeOpponent = 1;
    } else if (action === ACTIONS.RECEPTION && result === "Cパス") {
      // Cパスは慣例的に失点とすることがあるが、ここではスコア変動なしとする
    }
    return { scoreChangeOur, scoreChangeOpponent };
  };

  // --- ハンドラ関数 ---

  // Roster Modal
  const handleOpenRosterModal = () => setIsRosterModalOpen(true);
  const handleCloseRosterModal = () => { setRoster(new Map()); setIsRosterModalOpen(false); };
  const handleRosterChange = (playerId: string, displayName: string, position: string) => {
    setRoster(prev => {
      const newRoster = new Map(prev);
      if (position === "SUB" || !position) {
        newRoster.delete(playerId);
      } else {
        newRoster.set(playerId, { playerId, displayName, position });
      }
      return newRoster;
    });
  };

  const handleStartSet = async () => {
    if (!teamInfo?.id || !matchId) return;
    if (roster.size < 1) { // 6人でなくても開始できるよう緩和
      alert("少なくとも1人の選手をポジションに設定してください。");
      return;
    }
    setLoading(true);
    const teamId = teamInfo.id;
    const nextSetNumber = sets.length + 1;
    const rosterArray = Array.from(roster.values());

    try {
      const matchRef = doc(db, `teams/${teamId}/matches/${matchId}`);
      const setsRef = collection(matchRef, 'sets');
      
      await runTransaction(db, async (transaction) => {
        // 進行中のセットがあれば終了させる
        const ongoingSetsQuery = query(setsRef, where("status", "==", "ongoing"));
        const ongoingSetsSnap = await getDocs(ongoingSetsQuery);
        ongoingSetsSnap.forEach(setDoc => {
          transaction.update(setDoc.ref, { status: 'finished', updatedAt: serverTimestamp() });
        });

        // 新しいセットを追加
        const newSetRef = doc(setsRef); // IDを自動生成
        transaction.set(newSetRef, {
          setNumber: nextSetNumber,
          ourScore: 0,
          opponentScore: 0,
          status: 'ongoing',
          roster: rosterArray,
          createdAt: serverTimestamp(),
        });
        
        // 試合自体のステータスを'ongoing'に更新
        transaction.update(matchRef, { status: 'ongoing', updatedAt: serverTimestamp() });
      });

      handleCloseRosterModal();
    } catch (err) {
      console.error(err);
      setError("セットの開始に失敗しました。");
    } finally {
      setLoading(false);
    }
  };
  
  // Action Modal
  const handlePlayerTileClick = (player: RosterPlayer) => {
    setSelectedPlayer(player);
    setIsActionModalOpen(true);
  };
  const handleCloseActionModal = () => {
    setSelectedPlayer(null);
    setSelectedAction(null);
    setIsActionModalOpen(false);
  };

  const handleRecordEvent = async (result: string) => {
    if (!teamInfo?.id || !matchId || !activeSet || !selectedPlayer || !selectedAction) return;
    const teamId = teamInfo.id;
    const setRef = doc(db, `teams/${teamId}/matches/${matchId}/sets/${activeSet.id}`);
    
    try {
        const { scoreChangeOur, scoreChangeOpponent } = calculateScoreChange(selectedAction, result);

        await runTransaction(db, async (transaction) => {
            const setDoc = await transaction.get(setRef);
            if (!setDoc.exists()) { throw new Error("Set does not exist!"); }
            
            const currentOurScore = setDoc.data().ourScore || 0;
            const currentOpponentScore = setDoc.data().opponentScore || 0;

            const newEventRef = doc(collection(setRef, 'events'));
            transaction.set(newEventRef, {
                playerId: selectedPlayer.playerId,
                playerName: selectedPlayer.displayName,
                position: selectedPlayer.position,
                action: selectedAction,
                result: result,
                createdAt: serverTimestamp(),
                ourScore_at_event: currentOurScore + scoreChangeOur,
                opponentScore_at_event: currentOpponentScore + scoreChangeOpponent,
            });

            transaction.update(setRef, {
                ourScore: currentOurScore + scoreChangeOur,
                opponentScore: currentOpponentScore + scoreChangeOpponent,
                updatedAt: serverTimestamp(),
            });
        });
        
    } catch (err) {
        console.error(err);
        setError("記録の保存に失敗しました。");
    } finally {
        handleCloseActionModal();
    }
  };
  
  const handleRecordTeamEvent = async (action: string) => {
      if (!teamInfo?.id || !matchId || !activeSet) return;
      const teamId = teamInfo.id;
      const setRef = doc(db, `teams/${teamId}/matches/${matchId}/sets/${activeSet.id}`);

      try {
          const { scoreChangeOur, scoreChangeOpponent } = calculateScoreChange(action, "");

          await runTransaction(db, async (transaction) => {
              const setDoc = await transaction.get(setRef);
              if (!setDoc.exists()) { throw new Error("Set does not exist!"); }

              const currentOurScore = setDoc.data().ourScore || 0;
              const currentOpponentScore = setDoc.data().opponentScore || 0;

              const newEventRef = doc(collection(setRef, 'events'));
              transaction.set(newEventRef, {
                  playerId: null,
                  playerName: "チーム",
                  position: null,
                  action: action,
                  result: "",
                  createdAt: serverTimestamp(),
                  ourScore_at_event: currentOurScore + scoreChangeOur,
                  opponentScore_at_event: currentOpponentScore + scoreChangeOpponent,
              });

              transaction.update(setRef, {
                  ourScore: currentOurScore + scoreChangeOur,
                  opponentScore: currentOpponentScore + scoreChangeOpponent,
                  updatedAt: serverTimestamp(),
              });
          });
      } catch (err) {
          console.error(err);
          setError("チームプレーの記録に失敗しました。");
      }
  };


  // Edit/Undo Modal
  const handleUndoEvent = async () => {
    if (!events || events.length === 0 || !activeSet || !teamInfo?.id || !matchId) return;

    const lastEvent = events[0];
    await handleDeleteSpecificEvent(lastEvent.id, false); // 確認なしで削除
  };

  const handleOpenEditModal = (event: Event) => {
    const player = players.find(p => p.id === event.playerId);
    if (player) {
      setEditingEvent({
        id: event.id,
        player: player,
        action: event.action,
        result: event.result
      });
      setIsEditModalOpen(true);
    } else {
      setError("編集対象の選手が見つかりません。")
    }
  };

  const handleCloseEditModal = () => {
    setEditingEvent(null);
    setIsEditModalOpen(false);
  };
  
  // *** NEW/MODIFIED ***: Function to delete any specific event and recalculate score
  const handleDeleteSpecificEvent = async (eventIdToDelete: string, shouldConfirm: boolean = true) => {
    if (!teamInfo?.id || !matchId || !activeSet) return;
    if (shouldConfirm && !window.confirm("このプレー記録を完全に削除しますか？この操作は元に戻せません。")) return;

    const teamId = teamInfo.id;
    const setRef = doc(db, `teams/${teamId}/matches/${matchId}/sets/${activeSet.id}`);
    const eventToDeleteRef = doc(collection(setRef, 'events'), eventIdToDelete);
    const eventsCollectionRef = collection(setRef, 'events');

    try {
      // 1. トランザクションの外で現在のイベントリストを取得
      const allEventsQuery = query(eventsCollectionRef, orderBy('createdAt', 'asc'));
      const allEventsSnap = await getDocs(allEventsQuery);
      
      // 2. メモリ上で削除対象を除外し、スコアを再計算
      let newOurScore = 0;
      let newOpponentScore = 0;
      const eventsAfterDelete = allEventsSnap.docs.filter(doc => doc.id !== eventIdToDelete);

      eventsAfterDelete.forEach(doc => {
        const event = doc.data();
        const { scoreChangeOur, scoreChangeOpponent } = calculateScoreChange(event.action, event.result);
        newOurScore += scoreChangeOur;
        newOpponentScore += scoreChangeOpponent;
      });

      // 3. トランザクションでアトミックに書き込み
      await runTransaction(db, async (transaction) => {
        const setDoc = await transaction.get(setRef);
        if (!setDoc.exists()) { throw "Set document does not exist!"; }
        
        transaction.delete(eventToDeleteRef);
        transaction.update(setRef, {
            ourScore: newOurScore,
            opponentScore: newOpponentScore,
            updatedAt: serverTimestamp()
        });
      });
      
      // 削除が完了したら、開いているモーダルを閉じる
      if (isAllEventsModalOpen) closeAllEventsModal();
      if (isEditModalOpen) handleCloseEditModal();

    } catch (error) {
      console.error("プレーの削除に失敗しました: ", error);
      setError("プレーの削除中にエラーが発生しました。");
    }
  };

  // *** NEW/MODIFIED ***: Function to update an event and recalculate score
  const handleUpdateEvent = async () => {
    if (!editingEvent || !teamInfo?.id || !matchId || !activeSet) return;
    
    const teamId = teamInfo.id;
    const setRef = doc(db, `teams/${teamId}/matches/${matchId}/sets/${activeSet.id}`);
    const eventToUpdateRef = doc(collection(setRef, 'events'), editingEvent.id);
    const eventsCollectionRef = collection(setRef, 'events');

    try {
        // 1. 全イベントを取得
        const allEventsQuery = query(eventsCollectionRef, orderBy('createdAt', 'asc'));
        const allEventsSnap = await getDocs(allEventsQuery);

        // 2. メモリ上でイベントリストを更新し、スコアを再計算
        let newOurScore = 0;
        let newOpponentScore = 0;
        
        allEventsSnap.docs.forEach(doc => {
            let eventData = doc.data();
            // 更新対象のイベントであれば、モーダルで編集されたデータを使う
            if (doc.id === editingEvent.id) {
                eventData = {
                    ...eventData,
                    playerId: editingEvent.player.id,
                    playerName: editingEvent.player.displayName,
                    action: editingEvent.action,
                    result: editingEvent.result
                };
            }
            const { scoreChangeOur, scoreChangeOpponent } = calculateScoreChange(eventData.action, eventData.result);
            newOurScore += scoreChangeOur;
            newOpponentScore += scoreChangeOpponent;
        });

        // 3. トランザクションでアトミックに書き込み
        await runTransaction(db, async (transaction) => {
            const setDoc = await transaction.get(setRef);
            if (!setDoc.exists()) { throw "Set document does not exist!"; }

            transaction.update(eventToUpdateRef, {
                playerId: editingEvent.player.id,
                playerName: editingEvent.player.displayName,
                action: editingEvent.action,
                result: editingEvent.result,
                updatedAt: serverTimestamp(),
            });

            transaction.update(setRef, {
                ourScore: newOurScore,
                opponentScore: newOpponentScore,
                updatedAt: serverTimestamp()
            });
        });

        handleCloseEditModal();
        if (isAllEventsModalOpen) closeAllEventsModal();

    } catch (error) {
        console.error("プレーの更新に失敗しました: ", error);
        setError("プレーの更新中にエラーが発生しました。");
    }
  };

  // *** NEW ***: Handlers for the all events history modal
  const openAllEventsModal = () => setIsAllEventsModalOpen(true);
  const closeAllEventsModal = () => setIsAllEventsModalOpen(false);

  // --- メモ化された計算結果 ---
  const courtPlayers = useMemo(() => activeSet?.roster.filter(p => p.position !== 'SUB') || [], [activeSet]);
  const subPlayers = useMemo(() => {
    if (!activeSet) return players;
    const onCourtIds = new Set(activeSet.roster.map(p => p.playerId));
    return players.filter(p => !onCourtIds.has(p.id));
  }, [activeSet, players]);

  // --- レンダリング ---
  if (loading) return <div className="flex min-h-screen items-center justify-center bg-gray-100"><p>試合データを読み込んでいます...</p></div>;
  if (error) return <div className="flex min-h-screen items-center justify-center bg-gray-100"><p className="text-red-500 max-w-md text-center">エラー: {error}</p></div>;
  if (!match) return <div className="flex min-h-screen items-center justify-center bg-gray-100"><p>試合が見つかりません。</p></div>;

  return (
    <main className="min-h-screen bg-gray-100 p-2 sm:p-8">
      <div className="w-full max-w-5xl mx-auto">
        {/* Header */}
        <header className="bg-white p-4 rounded-lg shadow-md mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">vs {match.opponent}</h1>
              <p className="text-sm text-gray-600">
                {sets.map(s => `${s.ourScore}-${s.opponentScore}`).join(' / ')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link href={`/matches/${matchId}/summary`}><span className="px-3 py-2 bg-gray-500 text-white text-xs font-semibold rounded-md hover:bg-gray-600">集計</span></Link>
              <Link href="/dashboard"><span className="px-3 py-2 bg-blue-500 text-white text-xs font-semibold rounded-md hover:bg-blue-600">ダッシュボード</span></Link>
            </div>
          </div>
        </header>

        {activeSet ? (
          // --- 試合記録中 ---
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              {/* Scoreboard */}
              <div className="bg-white p-4 rounded-lg shadow-md flex justify-around items-center">
                <div className="text-center">
                  <p className="text-lg font-semibold text-gray-800">自チーム</p>
                  <p className="text-5xl font-bold text-blue-600">{activeSet.ourScore}</p>
                </div>
                <div className="text-center">
                  <p className="text-md text-gray-700">Set {activeSet.setNumber}</p>
                  <div className="flex gap-2 mt-2">
                    {/* *** NEW ***: "All History" button */}
                    <button onClick={openAllEventsModal} className="px-3 py-1 bg-gray-200 text-gray-800 text-xs font-semibold rounded-md hover:bg-gray-300">全履歴</button>
                    <button onClick={handleUndoEvent} className="px-3 py-1 bg-yellow-500 text-white text-xs font-semibold rounded-md hover:bg-yellow-600">取消</button>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-gray-800">相手チーム</p>
                  <p className="text-5xl font-bold text-red-600">{activeSet.opponentScore}</p>
                </div>
              </div>

              {/* Player Tiles */}
              <div className="grid grid-cols-3 sm:grid-cols-3 gap-3">
                {courtPlayers.map(player => (
                  <div key={player.playerId} onClick={() => handlePlayerTileClick(player)} className="bg-white p-3 rounded-lg shadow-md text-center cursor-pointer hover:bg-blue-50 transition-colors">
                    <p className="font-bold text-lg text-gray-900">{player.displayName}</p>
                    <p className="text-sm text-blue-700 font-semibold">{player.position}</p>
                  </div>
                ))}
              </div>
               {/* Team Actions */}
              <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => handleRecordTeamEvent(TEAM_ACTIONS.OPPONENT_ERROR)} className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded-lg shadow-md transition-colors">相手のミス</button>
                  <button onClick={() => handleRecordTeamEvent(TEAM_ACTIONS.OUR_ERROR)} className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-4 rounded-lg shadow-md transition-colors">こちらのミス</button>
              </div>
            </div>

            {/* Event Log */}
            <div className="bg-white p-4 rounded-lg shadow-md">
              <h2 className="text-lg font-semibold mb-3 text-gray-800">直近のプレー</h2>
              <ul className="space-y-2">
                {events.slice(0, 10).map((event) => (
                  <li key={event.id} onClick={() => handleOpenEditModal(event)} className="text-sm p-2 rounded-md hover:bg-gray-100 cursor-pointer border-b border-gray-200">
                    <p className="font-semibold text-gray-900">{event.playerName}: <span className="font-normal">{event.action} - {event.result}</span></p>
                    <p className="text-xs text-gray-500">{event.createdAt?.toDate().toLocaleTimeString()}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          // --- セット開始前 ---
          <div className="text-center bg-white p-8 rounded-lg shadow-md">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">次のセットを開始</h2>
            <p className="text-gray-600 mb-6">出場する選手とポジションを選択してください。</p>
            <button onClick={handleOpenRosterModal} className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg shadow-md transition-colors">
              ロスターを選択してセット開始
            </button>
          </div>
        )}
      </div>

      {/* --- Modals --- */}
      
      {/* Roster Selection Modal */}
      {isRosterModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center p-4">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg">
            <h2 className="text-xl font-bold mb-4">スターティングメンバー選択</h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {players.map(p => (
                <div key={p.id} className="flex items-center justify-between border-b pb-2">
                  <span className="text-gray-900">{p.displayName}</span>
                  <select onChange={(e) => handleRosterChange(p.id, p.displayName, e.target.value)} className="border border-gray-300 p-1 rounded-md text-gray-900">
                    <option value="SUB">控え</option>
                    {POSITIONS.filter(pos => pos !== 'SUB').map(pos => <option key={pos} value={pos}>{pos}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-4 mt-6">
              <button onClick={handleCloseRosterModal} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">キャンセル</button>
              <button onClick={handleStartSet} className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">セット開始</button>
            </div>
          </div>
        </div>
      )}

      {/* Action Recording Modal */}
      {isActionModalOpen && selectedPlayer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center p-4">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm">
            <h2 className="text-xl font-bold mb-4">{selectedPlayer.displayName}のプレー</h2>
            {!selectedAction ? (
              <div className="grid grid-cols-2 gap-3">
                {Object.values(ACTIONS).map(action => (
                  <button key={action} onClick={() => setSelectedAction(action)} className="p-3 bg-gray-200 rounded-md hover:bg-gray-300">{action}</button>
                ))}
              </div>
            ) : (
              <div>
                <h3 className="text-lg font-semibold mb-3">{selectedAction}</h3>
                <div className="flex flex-col gap-3">
                  {RESULTS[selectedAction]?.map((result: string) => (
                    <button key={result} onClick={() => handleRecordEvent(result)} className="p-3 bg-blue-500 text-white rounded-md hover:bg-blue-600">{result}</button>
                  ))}
                </div>
                <button onClick={() => setSelectedAction(null)} className="mt-4 text-sm text-gray-600 hover:underline">← プレー選択に戻る</button>
              </div>
            )}
            <button onClick={handleCloseActionModal} className="w-full mt-6 px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">閉じる</button>
          </div>
        </div>
      )}

      {/* Event Edit Modal */}
      {isEditModalOpen && editingEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center p-4">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">プレーを編集</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">選手</label>
                <select value={editingEvent.player.id} onChange={(e) => setEditingEvent({ ...editingEvent, player: players.find(p => p.id === e.target.value)! })} className="w-full mt-1 border border-gray-300 p-2 rounded-md text-gray-900">
                  {players.map(p => <option key={p.id} value={p.id}>{p.displayName}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">プレー</label>
                <select value={editingEvent.action} onChange={(e) => setEditingEvent({ ...editingEvent, action: e.target.value, result: (RESULTS as Record<string, string[]>)[e.target.value][0] })} className="w-full mt-1 border border-gray-300 p-2 rounded-md text-gray-900">
                  {Object.values(ACTIONS).map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">結果</label>
                <select value={editingEvent.result} onChange={(e) => setEditingEvent({ ...editingEvent, result: e.target.value })} className="w-full mt-1 border border-gray-300 p-2 rounded-md text-gray-900">
                  {(RESULTS[editingEvent.action] as string[]).map((r: string) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-between items-center mt-6">
               <button onClick={() => handleDeleteSpecificEvent(editingEvent.id)} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">このプレーを削除</button>
              <div className="flex gap-4">
                <button type="button" onClick={handleCloseEditModal} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">キャンセル</button>
                <button onClick={handleUpdateEvent} className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">更新</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* *** NEW ***: All Events History Modal */}
      {isAllEventsModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center p-4">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">Set {activeSet?.setNumber} の全プレー履歴</h2>
              <button onClick={closeAllEventsModal} className="text-2xl font-light text-gray-700 hover:text-black">&times;</button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto">
              <ul className="divide-y divide-gray-200">
                {events.map((event) => (
                  <li key={event.id} className="py-3 px-2 flex justify-between items-center">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {event.playerName}: <span className="font-normal">{event.action} - {event.result || 'N/A'}</span>
                      </p>
                      <p className="text-xs text-gray-500">
                        {event.createdAt?.toDate().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleOpenEditModal(event)} className="px-3 py-1 bg-yellow-500 text-white text-xs font-semibold rounded-md hover:bg-yellow-600">編集</button>
                      <button onClick={() => handleDeleteSpecificEvent(event.id)} className="px-3 py-1 bg-red-500 text-white text-xs font-semibold rounded-md hover:bg-red-600">削除</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}