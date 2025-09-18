"use client";
import { useState, useEffect, useMemo, useRef, FormEvent } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useFirebase } from "@/app/FirebaseProvider";
import {
  doc,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
  Timestamp,
  runTransaction,
  onSnapshot,
  updateDoc,
  orderBy,
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  writeBatch,
  increment,
  addDoc,
} from "firebase/firestore";

/** ================================
 *  Firestoreドキュメント用の型
 *  ================================ */
type ActionStatus = "scheduled" | "ongoing" | "finished";
type SetStatus = "pending" | "ongoing" | "finished";
type ServerTS = ReturnType<typeof serverTimestamp>;

interface PlayerDoc { displayName: string; }
interface MatchDoc  { opponent: string; status: ActionStatus; }
interface RosterPlayer { playerId: string; displayName: string; position: string; }
interface TeamInfo { id: string; name: string; }

interface SetDoc {
  setNumber: number;
  ourScore: number;
  opponentScore: number;
  status: SetStatus;
  roster: RosterPlayer[];
  createdAt?: Timestamp | ServerTS;
  updatedAt?: Timestamp | ServerTS;
}

type ActionKey = "SERVE" | "ATTACK" | "BLOCK" | "DIG" | "RECEPTION" | "TOSS_MISS";
type ActionType = "サーブ" | "アタック" | "ブロック" | "ディグ" | "レセプション" | "トスミス";

interface EventDoc {
  action: ActionKey | string;
  result: string;
  playerId: string | null;
  playerName: string;
  position: string | null;
  createdAt: Timestamp | ServerTS;
  ourScore_at_event?: number;
  opponentScore_at_event?: number;
  updatedAt?: Timestamp | ServerTS;
}

/** ================================
 *  UI用の型（id付き）
 *  ================================ */
interface Player extends PlayerDoc { id: string; }
interface Match  extends MatchDoc  { id: string; }
interface Set    extends SetDoc    { id: string; }
interface Event {
  id: string;
  action: ActionKey | string;
  result: string;
  playerId: string | null;
  playerName: string;
  position: string | null;
  createdAt: Timestamp;
  ourScore_at_event?: number;
  opponentScore_at_event?: number;
}
interface EditingEvent { id: string; player: Player; action: ActionKey; result: string; }

/** ================================
 *  Firestore Data Converter
 *  ================================ */
function makeConverter<T extends object>(): FirestoreDataConverter<T> {
  return {
    toFirestore(obj: T) {
      const o = { ...(obj as unknown as Record<string, unknown>) };
      delete (o as Record<string, unknown>)["id"];
      return o as T;
    },
    fromFirestore(snapshot: QueryDocumentSnapshot, options) {
      return snapshot.data(options) as T;
    },
  };
}

const withId = <T extends object>(snap: QueryDocumentSnapshot<T>) =>
  ({ id: snap.id, ...snap.data() }) as { id: string } & T;

const playerConverter = makeConverter<PlayerDoc>();
const matchConverter  = makeConverter<MatchDoc>();
const setConverter    = makeConverter<SetDoc>();
const eventConverter  = makeConverter<EventDoc>();

/** ================================
 *  定数
 *  ================================ */
const POSITIONS = ["S", "OH", "OP", "MB", "L", "SUB"] as const;

const QUICK_ACTIONS = [
  { label: "アタック得点", action: "ATTACK", result: "得点", color: "bg-green-600" },
  { label: "アタック失点", action: "ATTACK", result: "失点", color: "bg-red-600" },
  { label: "サーブ得点", action: "SERVE", result: "得点", color: "bg-green-600" },
  { label: "サーブ失点", action: "SERVE", result: "失点", color: "bg-red-600" },
  { label: "ブロック得点", action: "BLOCK", result: "得点", color: "bg-green-600" },
  { label: "ブロック失点", action: "BLOCK", result: "失点", color: "bg-red-600" },
  { label: "レセプション失点", action: "RECEPTION", result: "失点", color: "bg-red-600" },
  { label: "ディグ失敗", action: "DIG", result: "失敗", color: "bg-red-600" },
  { label: "サーブ効果", action: "SERVE", result: "効果", color: "bg-teal-500" },
  { label: "サーブ成功", action: "SERVE", result: "成功", color: "bg-blue-600" },
  { label: "アタック成功", action: "ATTACK", result: "成功", color: "bg-blue-600" },
  { label: "ブロック成功", action: "BLOCK", result: "成功", color: "bg-blue-600" },
  { label: "レセプション A", action: "RECEPTION", result: "Aパス", color: "bg-lime-500" },
  { label: "レセプション B", action: "RECEPTION", result: "Bパス", color: "bg-amber-500" },
  { label: "レセプション C", action: "RECEPTION", result: "Cパス", color: "bg-orange-500" },
  { label: "ディグ成功", action: "DIG", result: "成功", color: "bg-lime-500" },
] as const;

const TEAM_ACTIONS = {
  OPPONENT_ERROR: "相手のミス（自チーム得点）",
  OUR_ERROR: "こちらのミス（相手チーム失点）",
} as const;

const ACTION_DEFINITIONS: Record<ActionKey, { label: ActionType; results: string[] }> = {
  SERVE:     { label: "サーブ",       results: ["得点", "成功", "効果", "失点"] },
  ATTACK:    { label: "アタック",     results: ["得点", "成功", "失点"] },
  BLOCK:     { label: "ブロック",     results: ["得点", "成功", "失点"] },
  DIG:       { label: "ディグ",       results: ["成功", "失敗"] },
  RECEPTION: { label: "レセプション", results: ["Aパス", "Bパス", "Cパス", "失点"] },
  TOSS_MISS: { label: "トスミス",     results: ["ミス"] },
};

/** ================================
 *  ヘルパー
 *  ================================ */
const timeFormatOptions: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
const toDateSafe = (ts?: Timestamp | ServerTS) => (ts instanceof Timestamp ? ts.toDate() : null);

/** ================================
 *  コンポーネント
 *  ================================ */
export default function MatchPage() {
  const { db } = useFirebase();
  const pathname = usePathname();
  const matchId = pathname.split("/")[2] || "";
  
  const [teamInfo, setTeamInfo] = useState<TeamInfo | null>(null);
  const teamId = teamInfo?.id ?? null;

  // --- state ---
  const [match, setMatch] = useState<Match | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [sets, setSets] = useState<Set[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSet, setActiveSet] = useState<Set | null>(null);
  const [viewingSetId, setViewingSetId] = useState<string | null>(null);
  const currentSet = useMemo(() => (viewingSetId ? sets.find(s => s.id === viewingSetId) ?? null : null), [sets, viewingSetId]);
  const [isPreparingNextSet, setIsPreparingNextSet] = useState(false);
  const [nextSetNumberPreview, setNextSetNumberPreview] = useState<number | null>(null);
  const [isRosterModalOpen, setIsRosterModalOpen] = useState(false);
  const [roster, setRoster] = useState<Map<string, RosterPlayer>>(new Map());
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<RosterPlayer | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EditingEvent | null>(null);
  const [isAllEventsModalOpen, setIsAllEventsModalOpen] = useState(false);
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [playerOutId, setPlayerOutId] = useState("");
  const [playerInId, setPlayerInId] = useState("");
  const [isProcessingEvent, setIsProcessingEvent] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  
  type LongPressMode = 'success' | null;
  const [longPressMode, setLongPressMode] = useState<LongPressMode>(null);
  const pressStartTimeRef = useRef(0);
  const isInitialLoadRef = useRef(true);

  useEffect(() => {
    const storedTeam = localStorage.getItem('currentTeam');
    if (storedTeam) { setTeamInfo(JSON.parse(storedTeam)); }
  }, []);
  
  // ★★★★★ 修正箇所 ★★★★★
  useEffect(() => {
    if (!db || !teamId || !matchId) return;
    setLoading(true);
    
    const matchRef = doc(db, `teams/${teamId}/matches/${matchId}`).withConverter(matchConverter);
    const playersRef = collection(db, `teams/${teamId}/players`).withConverter(playerConverter);

    const unmatch = onSnapshot(matchRef, (docSnap) => {
      if (docSnap.exists()) setMatch({ id: docSnap.id, ...docSnap.data() } as Match);
      else setError("試合が見つかりません。");
    }, () => setError("試合情報の取得に失敗しました。"));
    
    const unplayers = onSnapshot(playersRef, (snapshot) => {
        setPlayers(snapshot.docs.map(d => withId(d)) as Player[]);
        setLoading(false); // 選手リストの読み込みが完了したらローディングを終了
    }, (err) => {
        console.error("選手の読み込みに失敗しました: ", err);
        setError("選手の読み込みに失敗しました。");
        setLoading(false);
    });

    return () => { unmatch(); unplayers(); };
  }, [db, teamId, matchId]); // ★ 依存配列から `loading` を削除
  // ★★★★★ 修正箇所ここまで ★★★★★

  useEffect(() => {
    if (!db || !teamId || !matchId) return;
    const setsRef = collection(db, `teams/${teamId}/matches/${matchId}/sets`).withConverter(setConverter);
    const qy = query(setsRef, orderBy("setNumber", "asc"));
    const unsets = onSnapshot(qy, (snapshot) => {
        const newList = snapshot.docs.map(d => withId(d)) as Set[];
        const newActiveSet = newList.find(s => s.status === "ongoing") ?? null;
        setSets(newList);
        setActiveSet(newActiveSet);
        if (isInitialLoadRef.current) {
            isInitialLoadRef.current = false;
            const initialSet = newActiveSet ?? (newList.length > 0 ? newList[newList.length - 1] : null);
            setViewingSetId(initialSet?.id ?? null);
        } else {
            setViewingSetId(currentId => {
                if (currentId && !newList.some(s => s.id === currentId)) {
                    const fallbackSet = newActiveSet ?? (newList.length > 0 ? newList[newList.length - 1] : null);
                    return fallbackSet?.id ?? null;
                }
                return currentId;
            });
        }
    }, (err) => {
        console.error("セット情報の取得に失敗しました: ", err);
        setError("セット情報の取得に失敗しました。");
    });
    return () => { unsets(); };
  }, [db, teamId, matchId]);

  useEffect(() => {
    if (!db || !teamId || !matchId || !currentSet?.id) { setEvents([]); return; }
    const eventsRef = collection(db, `teams/${teamId}/matches/${matchId}/sets/${currentSet.id}/events`).withConverter(eventConverter);
    const qy = query(eventsRef, orderBy("createdAt", "desc"));
    const unevents = onSnapshot(qy, (snapshot) => setEvents(snapshot.docs.map(d => withId(d)) as Event[]), () => setError("プレー履歴の取得に失敗しました。"));
    return () => { unevents(); };
  }, [db, teamId, matchId, currentSet?.id]);

  const calculateScoreChange = (action: string, result: string) => {
    let scoreChangeOur = 0, scoreChangeOpponent = 0;
    if (action === TEAM_ACTIONS.OPPONENT_ERROR) scoreChangeOur = 1;
    else if (action === TEAM_ACTIONS.OUR_ERROR) scoreChangeOpponent = 1;
    else if (result === "得点") scoreChangeOur = 1;
    else if (result === "失点" || result === "失敗") scoreChangeOpponent = 1;
    return { scoreChangeOur, scoreChangeOpponent };
  };

  const handleOpenRosterModal = (setForRoster?: Set) => {
    const targetSet = setForRoster || currentSet;
    if (targetSet) {
      const m = new Map<string, RosterPlayer>();
      targetSet.roster.forEach(p => m.set(p.playerId, p));
      setRoster(m);
    } else { setRoster(new Map()); }
    setIsRosterModalOpen(true);
  };
  const handleCloseRosterModal = () => { setIsRosterModalOpen(false); setIsPreparingNextSet(false); setNextSetNumberPreview(null); };
  const handleRosterChange = (playerId: string, displayName: string, position: string) => {
    setRoster(prev => {
      const n = new Map(prev);
      if (position === "SUB" || !position) n.delete(playerId);
      else n.set(playerId, { playerId, displayName, position });
      return n;
    });
  };

  const handlePrepareNextSet = () => {
    const base = activeSet ?? (sets.length ? sets[sets.length - 1] : null);
    if (base) {
      const m = new Map<string, RosterPlayer>();
      base.roster.forEach(p => m.set(p.playerId, p));
      setRoster(m);
    } else { setRoster(new Map()); }
    const nextNo = Math.max(0, ...sets.map(s => s.setNumber)) + 1;
    setNextSetNumberPreview(nextNo);
    setIsPreparingNextSet(true);
    setViewingSetId(null);
    setIsRosterModalOpen(true);
  };

  const handleStartSet = async () => {
    if (!db || !teamId || !matchId) return;
    if (roster.size < 1) { alert("少なくとも1人の選手をポジションに設定してください。"); return; }
    const matchRef = doc(db, `teams/${teamId}/matches/${matchId}`).withConverter(matchConverter);
    const setsRef  = collection(matchRef, "sets").withConverter(setConverter);
    const nextSetNumber = Math.max(0, ...sets.map(s => s.setNumber)) + 1;
    try {
      const newSet = {
        setNumber: nextSetNumber, ourScore: 0, opponentScore: 0, status: "ongoing" as SetStatus,
        roster: Array.from(roster.values()), createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      };
      const newSetDocRef = await addDoc(setsRef, newSet);
      setViewingSetId(newSetDocRef.id);
      if (match?.status !== 'finished') { await updateDoc(matchRef, { status: "ongoing", updatedAt: serverTimestamp() }); }
      setIsPreparingNextSet(false);
      setNextSetNumberPreview(null);
      handleCloseRosterModal();
    } catch (e) { console.error(e); setError("セットの開始に失敗しました。"); }
  };

  const handleFinishSet = async () => {
    if (!db || !teamId || !matchId || !activeSet) return;
    if (!window.confirm("このセットを終了しますか？")) return;
    const setRef = doc(db, `teams/${teamId}/matches/${matchId}/sets/${activeSet.id}`).withConverter(setConverter);
    try { await updateDoc(setRef, { status: "finished", updatedAt: serverTimestamp() });
    } catch (e) { console.error(e); setError("セットの終了処理に失敗しました。"); }
  };

  const handleDeleteSet = async (setId: string) => {
    if (!db || !teamId || !matchId) return;
    const setToDelete = sets.find(s => s.id === setId);
    const setNumber = setToDelete ? setToDelete.setNumber : '';
    if (!window.confirm(`Set ${setNumber} とそのセット内の全てのプレー記録を完全に削除します。この操作は元に戻せません。よろしいですか？`)) return;
    try {
      const setRef = doc(db, `teams/${teamId}/matches/${matchId}/sets/${setId}`);
      const eventsRef = collection(setRef, 'events');
      const eventsSnap = await getDocs(eventsRef);
      const batch = writeBatch(db);
      eventsSnap.forEach(eventDoc => { batch.delete(eventDoc.ref); });
      batch.delete(setRef);
      await batch.commit();
    } catch (err) {
      console.error("セットの削除に失敗しました: ", err);
      setError("セットの削除に失敗しました。");
    }
  };

  const handleFinishMatch = async () => {
    if (!db || !teamId || !matchId) return;
    if (!window.confirm("試合を終了しますか？（進行中のセットがあれば終了します）")) return;
    const matchRef = doc(db, `teams/${teamId}/matches/${matchId}`).withConverter(matchConverter);
    const setsRef  = collection(matchRef, "sets").withConverter(setConverter);
    try {
      const batch = writeBatch(db);
      const qy = query(setsRef, where("status", "==", "ongoing"));
      const os = await getDocs(qy);
      os.docs.forEach(d => batch.update(d.ref, { status: "finished", updatedAt: serverTimestamp() }));
      batch.update(matchRef, { status: "finished", updatedAt: serverTimestamp() });
      await batch.commit();
    } catch (e) { console.error(e); setError("試合の終了処理に失敗しました。"); }
  };

  const handleCloseActionModal = () => { setSelectedPlayer(null); setLongPressMode(null); setIsActionModalOpen(false); };

  const handleRecordEvent = async (actionToRecord: string, result: string) => {
    if (!db || !teamId || !matchId || !currentSet || !selectedPlayer || isProcessingEvent) return;
    setIsProcessingEvent(true);
    try {
      const setRef = doc(db, `teams/${teamId}/matches/${matchId}/sets/${currentSet.id}`).withConverter(setConverter);
      const eventsRef = collection(setRef, "events").withConverter(eventConverter);
      const { scoreChangeOur, scoreChangeOpponent } = calculateScoreChange(actionToRecord, result);
      const batch = writeBatch(db);
      const newEventRef = doc(eventsRef);
      batch.set(newEventRef, {
        playerId: selectedPlayer.playerId, playerName: selectedPlayer.displayName, position: selectedPlayer.position,
        action: actionToRecord, result, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      if (scoreChangeOur > 0 || scoreChangeOpponent > 0) {
        batch.update(setRef, { ourScore: increment(scoreChangeOur), opponentScore: increment(scoreChangeOpponent), updatedAt: serverTimestamp(), });
      }
      await batch.commit();
    } catch (e) { console.error(e); setError("記録の保存に失敗しました。");
    } finally { handleCloseActionModal(); setIsProcessingEvent(false); }
  };

  const handleRecordTeamEvent = async (action: string) => {
    if (!db || !teamId || !matchId || !currentSet || isProcessingEvent) return;
    setIsProcessingEvent(true);
    try {
      const setRef = doc(db, `teams/${teamId}/matches/${matchId}/sets/${currentSet.id}`).withConverter(setConverter);
      const eventsRef = collection(setRef, "events").withConverter(eventConverter);
      const { scoreChangeOur, scoreChangeOpponent } = calculateScoreChange(action, "");
      const batch = writeBatch(db);
      const newEventRef = doc(eventsRef);
      batch.set(newEventRef, { playerId: null, playerName: "チーム", position: null, action, result: "", createdAt: serverTimestamp(), updatedAt: serverTimestamp(), });
      batch.update(setRef, { ourScore: increment(scoreChangeOur), opponentScore: increment(scoreChangeOpponent), updatedAt: serverTimestamp(), });
      await batch.commit();
    } catch (e) { console.error(e); setError("チームプレーの記録に失敗しました。");
    } finally { setIsProcessingEvent(false); }
  };
  
  const handleRecordSimpleMiss = async (actionKey: ActionKey) => {
    if (!db || !teamId || !matchId || !currentSet || !selectedPlayer || isProcessingEvent) return;
    setIsProcessingEvent(true);
    try {
      const eventsRef = collection(db, `teams/${teamId}/matches/${matchId}/sets/${currentSet.id}/events`).withConverter(eventConverter);
      await addDoc(eventsRef, {
        playerId: selectedPlayer.playerId, playerName: selectedPlayer.displayName, position: selectedPlayer.position,
        action: actionKey, result: "ミス", createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
    } catch (e) { console.error(e); setError("ミスの記録に失敗しました。");
    } finally { setIsProcessingEvent(false); handleCloseActionModal(); }
  };

  const handlePointerDown = () => { pressStartTimeRef.current = Date.now(); };
  const handlePointerUp = (player: RosterPlayer) => {
    const pressDuration = Date.now() - pressStartTimeRef.current;
    if (pressDuration < 400) { setLongPressMode('success'); } 
    else { setLongPressMode(null); }
    setSelectedPlayer(player);
    setIsActionModalOpen(true);
  };
  
  const handleUndoEvent = async () => { if (!events.length || !currentSet) return; await handleDeleteSpecificEvent(events[0].id, false); };
  const handleOpenEditModal = (event: Event) => {
    if (!event.playerId || !ACTION_DEFINITIONS[event.action as ActionKey]) { alert("チームに関するプレーは、ここから編集できません。"); return; }
    const player = players.find(p => p.id === event.playerId);
    if (!player) { setError("編集対象の選手が見つかりません。"); return; }
    setEditingEvent({ id: event.id, player, action: event.action as ActionKey, result: event.result });
    setIsEditModalOpen(true);
    setIsAllEventsModalOpen(false);
  };
  const handleCloseEditModal = () => { setEditingEvent(null); setIsEditModalOpen(false); };
  const recomputeScores = (docs: QueryDocumentSnapshot<EventDoc>[], excludeId?: string, override?: { id: string; action: string; result: string }) => {
    let our = 0, opp = 0;
    for (const d of docs) {
      if (excludeId && d.id === excludeId) continue;
      const data = d.data(); const isOv = override && d.id === override.id;
      const a = isOv ? override!.action : data.action; const r = isOv ? override!.result : data.result;
      const { scoreChangeOur, scoreChangeOpponent } = calculateScoreChange(a, r);
      our += scoreChangeOur; opp += scoreChangeOpponent;
    }
    return { our, opp };
  };
  const handleDeleteSpecificEvent = async (eventIdToDelete: string, shouldConfirm = true) => {
    if (!db || !teamId || !matchId || !currentSet) return;
    if (shouldConfirm && !window.confirm("このプレー記録を削除しますか？")) return;
    const setRef = doc(db, `teams/${teamId}/matches/${matchId}/sets/${currentSet.id}`).withConverter(setConverter);
    const eventsRef = collection(setRef, "events").withConverter(eventConverter);
    const eventRef = doc(eventsRef, eventIdToDelete);
    try {
      await runTransaction(db, async (t) => {
        const all = await getDocs(query(eventsRef, orderBy("createdAt", "asc")));
        const { our, opp } = recomputeScores(all.docs, eventIdToDelete);
        t.delete(eventRef);
        t.update(setRef, { ourScore: our, opponentScore: opp, updatedAt: serverTimestamp() });
      });
      if (isAllEventsModalOpen) setIsAllEventsModalOpen(false);
      if (isEditModalOpen) handleCloseEditModal();
    } catch (e) { console.error(e); setError("プレーの削除に失敗しました。"); }
  };
  const handleUpdateEvent = async () => {
    if (!db || !teamId || !matchId || !currentSet || !editingEvent) return;
    const actionToRecord = editingEvent.action;
    const setRef = doc(db, `teams/${teamId}/matches/${matchId}/sets/${currentSet.id}`).withConverter(setConverter);
    const eventsRef = collection(setRef, "events").withConverter(eventConverter);
    const eventRef = doc(eventsRef, editingEvent.id);
    try {
      await runTransaction(db, async (t) => {
        const all = await getDocs(query(eventsRef, orderBy("createdAt", "asc")));
        const { our, opp } = recomputeScores(all.docs, undefined, { id: editingEvent.id, action: actionToRecord, result: editingEvent.result, });
        t.update(eventRef, {
          playerId: editingEvent.player.id, playerName: editingEvent.player.displayName,
          action: actionToRecord, result: editingEvent.result, updatedAt: serverTimestamp(),
        });
        t.update(setRef, { ourScore: our, opponentScore: opp, updatedAt: serverTimestamp() });
      });
      handleCloseEditModal();
    } catch (e) { console.error(e); setError("プレーの更新に失敗しました。"); }
  };

  const openSubModal  = () => { setPlayerInId(""); setPlayerOutId(""); setIsSubModalOpen(true); };
  const closeSubModal = () => setIsSubModalOpen(false);
  const handleSubstitutePlayer = async () => {
    if (!db || !teamId || !matchId || !playerInId || !playerOutId || !currentSet) { alert("交代する選手を両方選択してください。"); return; }
    const setRef = doc(db, `teams/${teamId}/matches/${matchId}/sets/${currentSet.id}`).withConverter(setConverter);
    const playerInObject = players.find(p => p.id === playerInId);
    if (!playerInObject) { setError("交代加入する選手の情報が見つかりません。"); return; }
    const newRoster = currentSet.roster.map(rp => rp.playerId === playerOutId ? { ...rp, playerId: playerInObject.id, displayName: playerInObject.displayName } : rp);
    try { await updateDoc(setRef, { roster: newRoster, updatedAt: serverTimestamp() }); closeSubModal();
    } catch (e) { console.error(e); setError("選手交代の処理に失敗しました。"); }
  };

  const subPlayers = useMemo(() => {
    if (!currentSet) return [];
    const onCourt = new Set(currentSet.roster.map(p => p.playerId));
    return players.filter(p => !onCourt.has(p.id));
  }, [currentSet, players]);
  
  const handleAddPlayerInMatch = async (e: FormEvent) => {
    e.preventDefault();
    if (!db || !teamId || !newPlayerName.trim()) return;
    try {
      await addDoc(collection(db, `teams/${teamId}/players`), {
        displayName: newPlayerName.trim(), active: true,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      setNewPlayerName('');
    } catch (err) { console.error(err); setError("試合中の選手追加に失敗しました。"); }
  };

  const handleUpdateRoster = async () => {
    if (!db || !teamId || !matchId || !currentSet) return;
    if (roster.size < 1) { alert("少なくとも1人の選手をポジションに設定してください。"); return; }
    try {
      const setRef = doc(db, `teams/${teamId}/matches/${matchId}/sets/${currentSet.id}`);
      await updateDoc(setRef, { roster: Array.from(roster.values()), updatedAt: serverTimestamp() });
      alert("ロスターを更新しました。");
      handleCloseRosterModal();
    } catch (err) { console.error(err); setError("ロスターの更新に失敗しました。"); }
  };

  const displayedQuickActions = useMemo(() => {
    if (!selectedPlayer) return [];
    let actions = longPressMode === 'success' ? QUICK_ACTIONS.filter(a => a.result.includes('成功') || a.result.includes('パス') || a.result === '効果') : QUICK_ACTIONS.filter(a => !a.result.includes('成功') && !a.result.includes('パス') && a.result !== '効果');
    if (selectedPlayer.position === 'L') {
        actions = actions.filter(item => item.action !== 'ATTACK' && item.action !== 'BLOCK' && item.action !== 'SERVE');
    }
    return actions;
  }, [selectedPlayer, longPressMode]);

  if (loading || !teamInfo) return <div className="flex min-h-screen items-center justify-center bg-gray-100"><p>試合データを読み込んでいます...</p></div>;
  if (error) return <div className="flex min-h-screen items-center justify-center bg-gray-100"><p className="text-red-500 max-w-md text-center">エラー: {error}</p></div>;
  if (!match) return <div className="flex min-h-screen items-center justify-center bg-gray-100"><p>試合が見つかりません。</p></div>;

  return (
    <main className="min-h-screen bg-gray-100 p-2 sm:p-8">
      <div className="w-full max-w-5xl mx-auto">
        <header className="bg-white p-4 rounded-lg shadow-md mb-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">vs {match.opponent}</h1>
              <p className="text-base text-gray-700 font-medium mt-1">{sets.map(s => `${s.ourScore}-${s.opponentScore}`).join(" / ")}</p>
              {isPreparingNextSet && <p className="mt-1 text-sm text-blue-700 font-semibold">次のセット準備中：Set {nextSetNumberPreview ?? Math.max(0, ...sets.map(s => s.setNumber)) + 1}</p>}
            </div>
            <div className="flex items-center gap-3">
              {match.status !== "finished" && <button onClick={handleFinishMatch} className="px-4 py-2 bg-red-600 text-white text-base font-bold rounded-md hover:bg-red-700">試合終了</button>}
              <Link href={`/matches/${matchId}/summary`}><span className="px-4 py-2 bg-gray-600 text-white text-base font-bold rounded-md hover:bg-gray-700">集計</span></Link>
              <Link href="/dashboard"><span className="px-4 py-2 bg-blue-600 text-white text-base font-bold rounded-md hover:bg-blue-700">ダッシュボード</span></Link>
            </div>
          </div>
        </header>

        <div className="flex items-center gap-2 mb-4 p-2 bg-white rounded-lg shadow-md overflow-x-auto">
          {sets.map(s => (
            <button key={s.id} onClick={() => setViewingSetId(s.id)} className={`px-4 py-2 rounded-md font-bold text-sm whitespace-nowrap ${currentSet?.id === s.id ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-800 hover:bg-gray-300"}`}>
              Set {s.setNumber}{s.status === "ongoing" ? " (記録中)" : ""}
            </button>
          ))}
          {!activeSet && match.status !== "finished" && <button onClick={handlePrepareNextSet} className="px-4 py-2 rounded-md font-bold text-sm bg-green-500 text-white hover:bg-green-600 whitespace-nowrap">＋ 次のセット</button>}
        </div>

        {currentSet ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              <div className="bg-white p-4 rounded-lg shadow-md flex justify-around items-center">
                <div className="text-center"><p className="text-xl font-bold text-gray-800">自チーム</p><p className="text-6xl font-bold text-blue-600 tracking-tighter">{currentSet.ourScore}</p></div>
                <div className="text-center">
                  <p className="text-xl font-bold text-gray-800">Set {currentSet.setNumber}</p>
                  <div className="flex flex-wrap justify-center gap-2 mt-2">
                    <button onClick={() => setIsAllEventsModalOpen(true)} className="px-3 py-2 bg-gray-200 text-gray-900 text-sm font-bold rounded-md hover:bg-gray-300">全履歴</button>
                    {currentSet.status === "ongoing" ? (
                      <>
                        <button onClick={handleUndoEvent} className="px-3 py-2 bg-yellow-600 text-white text-sm font-bold rounded-md hover:bg-yellow-700">取消</button>
                        <button onClick={openSubModal} className="px-3 py-2 bg-green-600 text-white text-sm font-bold rounded-md hover:bg-green-700">選手交代</button>
                        <button onClick={() => handleOpenRosterModal()} className="px-3 py-2 bg-purple-600 text-white text-sm font-bold rounded-md hover:bg-purple-700">ロスター編集</button>
                        <button onClick={handleFinishSet} className="px-3 py-2 bg-red-600 text-white text-sm font-bold rounded-md hover:bg-red-700">セット終了</button>
                      </>
                    ) : (
                      <button onClick={() => handleOpenRosterModal()} className="px-3 py-2 bg-purple-600 text-white text-sm font-bold rounded-md hover:bg-purple-700">ロスター編集</button>
                    )}
                    <button onClick={() => handleDeleteSet(currentSet.id)} className="px-3 py-2 bg-pink-700 text-white text-sm font-bold rounded-md hover:bg-pink-800">セット削除</button>
                  </div>
                </div>
                <div className="text-center"><p className="text-xl font-bold text-gray-800">相手チーム</p><p className="text-6xl font-bold text-red-600 tracking-tighter">{currentSet.opponentScore}</p></div>
              </div>

              <>
                {currentSet.status !== "ongoing" && <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 p-4 mb-4 rounded-r-lg" role="alert"><p className="font-bold">編集モード</p><p>このセットは終了していますが、プレーの追加・修正が可能です。</p></div>}
                <div className="grid grid-cols-3 sm:grid-cols-3 gap-4">
                  {currentSet.roster.filter(p => p.position !== "SUB").map(player => (
                    <div
                      key={player.playerId}
                      onPointerDown={handlePointerDown}
                      onPointerUp={() => handlePointerUp(player)}
                      onContextMenu={(e) => { e.preventDefault(); handlePointerUp(player); }}
                      className="bg-white p-4 rounded-lg shadow-md text-center cursor-pointer hover:bg-blue-50 select-none"
                    >
                      <p className="font-bold text-xl text-gray-900">{player.displayName}</p>
                      <p className="text-base text-blue-800 font-semibold">{player.position}</p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => handleRecordTeamEvent(TEAM_ACTIONS.OPPONENT_ERROR)} disabled={isProcessingEvent} className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-lg shadow-md text-lg disabled:bg-gray-400 disabled:cursor-not-allowed">相手のミス</button>
                  <button onClick={() => handleRecordTeamEvent(TEAM_ACTIONS.OUR_ERROR)} disabled={isProcessingEvent} className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-4 rounded-lg shadow-md text-lg disabled:bg-gray-400 disabled:cursor-not-allowed">こちらのミス</button>
                </div>
              </>
            </div>

            <div className="bg-white p-4 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">プレー履歴 (Set {currentSet.setNumber})</h2>
              <ul className="space-y-3">
                {events.map(event => (
                  <li key={event.id} className="p-3 border-b">
                    <p className="font-semibold text-base text-gray-800">{event.playerName}: <span className="font-medium text-gray-700">{ACTION_DEFINITIONS[event.action as ActionKey]?.label || event.action} - {event.result || "N/A"}</span></p>
                    <p className="text-sm text-gray-600 mt-1">{toDateSafe(event.createdAt)?.toLocaleTimeString("ja-JP", timeFormatOptions) ?? ""}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <>
            {match.status === "finished" ? (
              <div className="text-center bg-white p-10 rounded-lg shadow-md">
                <h2 className="text-3xl font-bold text-gray-800 mb-4">この試合は終了しています</h2>
                <p className="text-gray-700 mb-8 text-lg">結果・集計を確認できます。</p>
                <Link href={`/matches/${matchId}/summary`}><span className="inline-block bg-gray-700 hover:bg-gray-800 text-white font-bold py-4 px-8 rounded-lg shadow-md text-lg">集計を見る</span></Link>
              </div>
            ) : (
              <div className="text-center bg-white p-10 rounded-lg shadow-md">
                <h2 className="text-3xl font-bold text-gray-800 mb-4">最初のセットを開始</h2>
                <p className="text-gray-700 mb-8 text-lg">出場する選手とポジションを選択してください。</p>
                <button onClick={handlePrepareNextSet} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-lg shadow-md text-lg">ロスターを選択してセット開始</button>
              </div>
            )}
          </>
        )}
      </div>

      {isRosterModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center p-4">
          <div className="bg-white p-6 sm:p-8 rounded-lg shadow-xl w-full max-w-2xl">
            <h2 className="text-2xl font-bold mb-2 text-gray-900">{isPreparingNextSet ? `Set ${nextSetNumberPreview ?? ''} のメンバー選択` : `Set ${currentSet?.setNumber} のロスター編集`}</h2>
            {!isPreparingNextSet && <p className="mb-4 text-sm text-gray-600">選手の追加、ポジション変更、控えへの移動が可能です。</p>}
            <div className="my-4 p-4 border rounded-md bg-gray-50">
              <h3 className="text-lg font-semibold mb-2 text-gray-800">新しい選手をチームに追加</h3>
              <form onSubmit={handleAddPlayerInMatch} className="flex gap-2">
                <input type="text" value={newPlayerName} onChange={(e) => setNewPlayerName(e.target.value)} placeholder="選手名" className="flex-grow border border-gray-300 p-2 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                <button type="submit" className="bg-green-500 text-white font-bold py-2 px-4 rounded-md hover:bg-green-600 transition-colors">追加</button>
              </form>
            </div>
            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-4">
              {players.map(p => (
                <div key={p.id} className="flex flex-col sm:flex-row items-center justify-between border-b py-4">
                  <span className="text-lg text-gray-900 font-medium mb-3 sm:mb-0">{p.displayName}</span>
                  <div className="flex flex-wrap gap-2 justify-start sm:justify-end">
                    <button type="button" onClick={() => handleRosterChange(p.id, p.displayName, "SUB")} className={`px-3 py-1 text-sm font-semibold rounded-full transition-colors ${(roster.get(p.id)?.position || "SUB") === "SUB" ? "bg-gray-700 text-white" : "bg-transparent border border-gray-400 text-gray-600 hover:bg-gray-100"}`}>控え</button>
                    {POSITIONS.filter(pos => pos !== "SUB").map(pos => (
                      <button key={pos} type="button" onClick={() => handleRosterChange(p.id, p.displayName, pos)} className={`w-12 px-3 py-1 text-sm font-semibold rounded-full transition-colors ${roster.get(p.id)?.position === pos ? "bg-blue-600 text-white" : "bg-transparent border border-gray-400 text-gray-600 hover:bg-gray-100"}`}>{pos}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-4 mt-8">
              <button onClick={handleCloseRosterModal} className="px-6 py-3 bg-gray-200 text-gray-900 font-bold rounded-md hover:bg-gray-300">キャンセル</button>
              {isPreparingNextSet ? (
                <button onClick={handleStartSet} className="px-6 py-3 bg-blue-600 text-white font-bold rounded-md hover:bg-blue-700">セット開始</button>
              ) : (
                <button onClick={handleUpdateRoster} className="px-6 py-3 bg-purple-600 text-white font-bold rounded-md hover:bg-purple-700">ロスターを更新</button>
              )}
            </div>
          </div>
        </div>
      )}
      
      {isActionModalOpen && selectedPlayer && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center p-4">
          <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-lg">
            <h2 className="text-2xl font-bold mb-6 text-gray-900">{selectedPlayer.displayName}のプレー</h2>
            <div className="grid grid-cols-2 gap-3">
              {displayedQuickActions.map(item => (
                <button key={item.label} onClick={() => handleRecordEvent(item.action, item.result)} disabled={isProcessingEvent} className={`p-4 rounded-md font-bold text-lg text-white shadow-md ${item.color} hover:opacity-90 disabled:bg-gray-400 disabled:cursor-not-allowed`}>
                  {isProcessingEvent ? '記録中...' : item.label}
                </button>
              ))}
              {selectedPlayer.position === 'S' && longPressMode === 'success' && (
                  <button onClick={() => handleRecordSimpleMiss("TOSS_MISS")} disabled={isProcessingEvent} className="p-4 rounded-md font-bold text-lg text-white shadow-md bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400">{isProcessingEvent ? '記録中...' : 'トスミス'}</button>
              )}
            </div>
            <button onClick={handleCloseActionModal} className="w-full mt-8 px-4 py-3 bg-gray-500 text-white font-bold rounded-md hover:bg-gray-600">閉じる</button>
          </div>
        </div>
      )}

      {isEditModalOpen && editingEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center p-4">
          <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
            <h2 className="text-2xl font-bold mb-6 text-gray-900">プレーを編集</h2>
            <div className="space-y-5">
              <div> <label className="block text-base font-medium text-gray-700">選手</label> <select value={editingEvent.player.id} onChange={(e) => setEditingEvent({ ...editingEvent, player: players.find(p => p.id === e.target.value)! })} className="w-full mt-1 border p-3 rounded-md text-base">{players.map(p => <option key={p.id} value={p.id}>{p.displayName}</option>)}</select> </div>
              <div> <label className="block text-base font-medium text-gray-700">プレー</label> <select value={editingEvent.action} onChange={(e) => setEditingEvent({ ...editingEvent, action: e.target.value as ActionKey, result: ACTION_DEFINITIONS[e.target.value as ActionKey].results[0] })} className="w-full mt-1 border p-3 rounded-md text-base">{Object.entries(ACTION_DEFINITIONS).map(([key, { label }]) => <option key={key} value={key}>{label}</option>)}</select> </div>
              <div> <label className="block text-base font-medium text-gray-700">結果</label> <select value={editingEvent.result} onChange={(e) => setEditingEvent({ ...editingEvent, result: e.target.value })} className="w-full mt-1 border p-3 rounded-md text-base">{ACTION_DEFINITIONS[editingEvent.action].results.map(r => <option key={r} value={r}>{r}</option>)}</select> </div>
            </div>
            <div className="flex justify-between items-center mt-8">
              <button onClick={() => handleDeleteSpecificEvent(editingEvent.id)} className="px-5 py-3 bg-red-600 text-white font-bold rounded-md hover:bg-red-700">このプレーを削除</button>
              <div className="flex gap-4">
                <button type="button" onClick={handleCloseEditModal} className="px-5 py-3 bg-gray-200 text-gray-900 font-bold rounded-md hover:bg-gray-300">キャンセル</button>
                <button onClick={handleUpdateEvent} className="px-5 py-3 bg-blue-600 text-white font-bold rounded-md hover:bg-blue-700">更新</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isAllEventsModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center p-4">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Set {currentSet?.setNumber} の全プレー履歴</h2>
              <button onClick={() => setIsAllEventsModalOpen(false)} className="text-3xl font-light text-gray-700 hover:text-black">&times;</button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto">
              <ul className="divide-y divide-gray-200">
                {events.map(event => (
                  <li key={event.id} className="py-4 px-2 flex justify-between items-center">
                    <div>
                      <p className="text-base font-medium text-gray-800">{event.playerName}: <span className="font-normal text-gray-700">{ACTION_DEFINITIONS[event.action as ActionKey]?.label || event.action} - {event.result || "N/A"}</span></p>
                      <div className="flex items-center mt-1">
                        <p className="text-sm text-gray-600">{event.createdAt?.toDate().toLocaleTimeString("ja-JP", timeFormatOptions)}</p>
                        {event.ourScore_at_event != null && event.opponentScore_at_event != null && (<p className="ml-4 text-sm font-mono tracking-wider text-gray-800 bg-gray-100 px-2 py-0.5 rounded">{event.ourScore_at_event} - {event.opponentScore_at_event}</p>)}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleOpenEditModal(event)} className="px-4 py-2 bg-yellow-600 text-white text-sm font-bold rounded-md hover:bg-yellow-700">編集</button>
                      <button onClick={() => handleDeleteSpecificEvent(event.id)} className="px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-md hover:bg-red-700">削除</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {isSubModalOpen && currentSet && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center p-4">
          <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
            <h2 className="text-2xl font-bold mb-6 text-gray-900">選手交代</h2>
            <div className="space-y-5">
              <div>
                <label htmlFor="player-out" className="block text-base font-medium text-gray-700">コートから退く選手</label>
                <select id="player-out" value={playerOutId} onChange={(e) => setPlayerOutId(e.target.value)} className="w-full p-3 text-lg font-medium text-gray-800 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors">
                  <option value="" disabled>選択してください</option>
                  {currentSet.roster.map(p => (<option key={p.playerId} value={p.playerId}>{p.displayName} ({p.position})</option>))}
                </select>
              </div>
              <div>
                <label htmlFor="player-in" className="block text-base font-medium text-gray-700 mb-2">コートに入る選手</label>
                <select id="player-in" value={playerInId} onChange={(e) => setPlayerInId(e.target.value)} className="w-full p-3 text-lg font-medium text-gray-800 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors">
                  <option value="" disabled>選択してください</option>
                  {subPlayers.map(p => (<option key={p.id} value={p.id}>{p.displayName}</option>))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-4 mt-8">
              <button onClick={closeSubModal} className="px-6 py-3 bg-gray-200 text-gray-900 font-bold rounded-md hover:bg-gray-300">キャンセル</button>
              <button onClick={handleSubstitutePlayer} className="px-6 py-3 bg-green-600 text-white font-bold rounded-md hover:bg-green-700">交代を実行</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}