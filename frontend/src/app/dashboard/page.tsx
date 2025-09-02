"use client";

import { useFirebase } from "../FirebaseProvider";
import { useState, useEffect, FormEvent } from "react";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  addDoc, 
  serverTimestamp,
  onSnapshot,
  deleteDoc,
  updateDoc
} from "firebase/firestore";

// Playerの型を定義
interface Player {
  id: string;
  displayName: string;
  position?: string;
}

export default function DashboardPage() {
  const { user, auth, db } = useFirebase();
  
  // 選手リストとフォーム入力の状態を管理
  const [players, setPlayers] = useState<Player[]>([]);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerPosition, setNewPlayerPosition] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 編集モーダル用のState
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // ログインユーザーが所属するチームIDを取得する
  const [teamId, setTeamId] = useState<string | null>(null);
  
  useEffect(() => {
    const findTeamId = async () => {
      const q = query(collection(db, 'teams'), where('code4', '==', '1234'));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        setTeamId(querySnapshot.docs[0].id);
      } else {
        setError("所属チームが見つかりません。");
      }
    };
    findTeamId();
  }, [db]);

  // 選手リストをリアルタイムで取得・更新する
  useEffect(() => {
    if (!teamId) return;

    setLoading(true);
    const playersRef = collection(db, `teams/${teamId}/players`);
    
    const unsubscribe = onSnapshot(playersRef, (querySnapshot) => {
      const playersData: Player[] = [];
      querySnapshot.forEach((doc) => {
        playersData.push({ id: doc.id, ...doc.data() } as Player);
      });
      setPlayers(playersData);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setError("選手の取得に失敗しました。");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db, teamId]);


  // 選手追加フォームの送信処理
  const handleAddPlayer = async (e: FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trim() || !teamId) return;

    try {
      const playersRef = collection(db, `teams/${teamId}/players`);
      await addDoc(playersRef, {
        displayName: newPlayerName.trim(),
        position: newPlayerPosition || null,
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setNewPlayerName('');
      setNewPlayerPosition('');
    } catch (err) {
      console.error(err);
      setError("選手の追加に失敗しました。");
    }
  };

  // 選手を削除する処理
  const handleDeletePlayer = async (playerId: string) => {
    if (!window.confirm("この選手を削除してもよろしいですか？")) {
      return;
    }
    if (!teamId) return;
    try {
      const playerDocRef = doc(db, `teams/${teamId}/players/${playerId}`);
      await deleteDoc(playerDocRef);
    } catch (err) {
      console.error(err);
      setError("選手の削除に失敗しました。");
    }
  };

  // 編集モーダルを開く処理
  const handleOpenModal = (player: Player) => {
    setEditingPlayer(player);
    setIsModalOpen(true);
  };

  // 編集モーダルを閉じる処理
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingPlayer(null);
  };

  // 選手情報を更新する処理
  const handleUpdatePlayer = async () => {
    if (!editingPlayer || !teamId) {
      setError("更新対象の選手またはチームが見つかりません。");
      return;
    }
    try {
      const playerDocRef = doc(db, `teams/${teamId}/players/${editingPlayer.id}`);
      await updateDoc(playerDocRef, {
        displayName: editingPlayer.displayName,
        position: editingPlayer.position || null,
        updatedAt: serverTimestamp(),
      });
      handleCloseModal();
    } catch (err) {
      console.error(err);
      setError("選手の更新に失敗しました。");
    }
  };


  if (!user) return null;

  return (
    <main className="flex min-h-screen flex-col items-center p-8 bg-gray-50">
      <div className="w-full max-w-4xl">
        {/* ヘッダー */}
        <header className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4"> {/* ← h1とLinkをまとめるdivを追加 */}
            <h1 className="text-3xl font-bold text-gray-800">選手管理</h1>
            <Link href="/matches/new">
              <span className="bg-green-500 text-white font-bold py-2 px-4 rounded-md hover:bg-green-600 transition-colors">
                ＋ 新しい試合を作成
              </span>
            </Link>
          </div>
          <button
            onClick={() => auth.signOut()}
            className="px-4 py-2 bg-red-500 text-white font-semibold rounded-md hover:bg-red-600 transition-colors"
          >
            ログアウト
          </button>
        </header>

        {/* 選手追加フォーム */}
        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          <h2 className="text-xl font-semibold mb-4">新しい選手を追加</h2>
          <form onSubmit={handleAddPlayer} className="flex flex-col sm:flex-row gap-4">
            <input
              type="text"
              value={newPlayerName}
              onChange={(e) => setNewPlayerName(e.target.value)}
              placeholder="選手名"
              className="flex-grow border border-gray-300 p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <select
              value={newPlayerPosition}
              onChange={(e) => setNewPlayerPosition(e.target.value)}
              className="border border-gray-300 p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">ポジションを選択 (任意)</option>
              <option value="S">S (セッター)</option>
              <option value="MB">MB (ミドルブロッカー)</option>
              <option value="OH">OH (アウトサイドヒッター)</option>
              <option value="OP">OP (オポジット)</option>
              <option value="L">L (リベロ)</option>
            </select>
            <button
              type="submit"
              className="bg-blue-500 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-600 transition-colors"
            >
              追加
            </button>
          </form>
        </div>

        {/* 選手一覧 */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">選手リスト</h2>
          {error && <p className="text-red-500 mb-4">{error}</p>}
          {loading ? (
            <p>読み込み中...</p>
          ) : players.length === 0 ? (
            <p>まだ選手が登録されていません。</p>
          ) : (
            <ul className="divide-y divide-gray-200">
              {players.map((player) => (
                <li key={player.id} className="py-4 flex justify-between items-center">
                  <div>
                    <p className="text-lg font-medium text-gray-900">{player.displayName}</p>
                    <p className="text-sm text-gray-500">{player.position || 'ポジション未設定'}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleOpenModal(player)}
                      className="px-3 py-1 bg-yellow-500 text-white text-sm font-semibold rounded-md hover:bg-yellow-600 transition-colors"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => handleDeletePlayer(player.id)}
                      className="px-3 py-1 bg-red-500 text-white text-sm font-semibold rounded-md hover:bg-red-600 transition-colors"
                    >
                      削除
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* 編集モーダル */}
      {isModalOpen && editingPlayer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
          <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
            <h2 className="text-2xl font-bold mb-6">選手情報を編集</h2>
            <form onSubmit={(e) => {
              e.preventDefault();
              handleUpdatePlayer();
            }}>
              <div className="mb-4">
                <label htmlFor="edit-player-name" className="block text-sm font-medium text-gray-700 mb-1">選手名</label>
                <input
                  id="edit-player-name"
                  type="text"
                  value={editingPlayer.displayName}
                  onChange={(e) => setEditingPlayer({ ...editingPlayer, displayName: e.target.value })}
                  className="w-full border border-gray-300 p-2 rounded-md"
                  required
                />
              </div>
              <div className="mb-6">
                <label htmlFor="edit-player-position" className="block text-sm font-medium text-gray-700 mb-1">ポジション</label>
                <select
                  id="edit-player-position"
                  value={editingPlayer.position || ''}
                  onChange={(e) => setEditingPlayer({ ...editingPlayer, position: e.target.value })}
                  className="w-full border border-gray-300 p-2 rounded-md"
                >
                  <option value="">ポジションを選択 (任意)</option>
                  <option value="S">S (セッター)</option>
                  <option value="MB">MB (ミドルブロッカー)</option>
                  <option value="OH">OH (アウトサイドヒッター)</option>
                  <option value="OP">OP (オポジット)</option>
                  <option value="L">L (リベロ)</option>
                </select>
              </div>
              <div className="flex justify-end gap-4">
                <button type="button" onClick={handleCloseModal} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">
                  キャンセル
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">
                  更新
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}