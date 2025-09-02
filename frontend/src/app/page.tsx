"use client";

import { useState } from 'react';
import { useFirebase } from './FirebaseProvider'; // 先ほど作成したカスタムフック
import { signInAnonymously } from 'firebase/auth';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';

export default function Home() {
  const { auth, db, user } = useFirebase(); // Firebaseのインスタンスとユーザー情報を取得
  const [teamCode, setTeamCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 参加ボタンがクリックされたときの処理
  const handleJoinTeam = async () => {
    if (teamCode.length !== 4) {
      setError('4桁のチームコードを入力してください。');
      return;
    }
    setLoading(true);
    setError('');

    try {
      // 1. チームコードが存在するかFirestoreで確認
      const teamsRef = collection(db, 'teams');
      const q = query(teamsRef, where('code4', '==', teamCode));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError('有効なチームコードではありません。');
        setLoading(false);
        return;
      }
      
      // チームが見つかった
      const teamId = querySnapshot.docs[0].id;
      console.log('Team found:', teamId);

      // 2. Firebaseに匿名サインイン
      const userCredential = await signInAnonymously(auth);
      console.log('Signed in anonymously:', userCredential.user.uid);

      // 3. (将来的には) teams/{teamId}/members/{userId} に参加情報を書き込む
      
    } catch (err) {
      console.error(err);
      setError('チームへの参加中にエラーが発生しました。');
    } finally {
      setLoading(false);
    }
  };

  // すでにログイン済みの場合はダッシュボードなどを表示
  if (user) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">ようこそ！</h1>
          <p className="mb-8">あなたはすでにチームに参加しています。</p>
          <p className="text-sm text-gray-500">UID: {user.uid}</p>
          <button
            onClick={() => auth.signOut()}
            className="mt-4 px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
          >
            ログアウト
          </button>
        </div>
      </main>
    );
  }

  // 未ログインの場合はチーム参加フォームを表示
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="w-full max-w-xs">
        <h1 className="text-center text-2xl font-bold mb-6">チームに参加</h1>
        <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="team-code">
              4桁のチームコード
            </label>
            <input
              id="team-code"
              type="text"
              value={teamCode}
              onChange={(e) => setTeamCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
              maxLength={4}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              placeholder="1234"
            />
          </div>
          {error && <p className="text-red-500 text-xs italic mb-4">{error}</p>}
          <div className="flex items-center justify-between">
            <button
              onClick={handleJoinTeam}
              disabled={loading}
              className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:bg-gray-400"
            >
              {loading ? '参加中...' : '参加する'}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}