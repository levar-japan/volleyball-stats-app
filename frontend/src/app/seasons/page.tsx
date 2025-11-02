"use client";
import { useState, useEffect, FormEvent } from 'react';
import { useFirebase } from '@/app/FirebaseProvider';
import { useRouter } from 'next/navigation';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy, serverTimestamp, Timestamp } from 'firebase/firestore';
import Link from 'next/link';

interface TeamInfo { id: string; name: string; }
interface Season {
  id: string;
  name: string;
  startDate: Timestamp;
  endDate: Timestamp;
  description?: string;
  createdAt?: Timestamp;
}

export default function SeasonsPage() {
  const { db } = useFirebase();
  const router = useRouter();
  const [teamInfo, setTeamInfo] = useState<TeamInfo | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSeason, setEditingSeason] = useState<Season | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    startDate: '',
    endDate: '',
    description: '',
  });

  useEffect(() => {
    const storedTeam = localStorage.getItem('currentTeam');
    if (storedTeam) {
      setTeamInfo(JSON.parse(storedTeam));
    } else {
      router.push('/dashboard');
    }
  }, [router]);

  useEffect(() => {
    if (!db || !teamInfo?.id) return;
    fetchSeasons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, teamInfo]);

  const fetchSeasons = async () => {
    if (!db || !teamInfo?.id) return;
    setLoading(true);
    try {
      const seasonsRef = collection(db, `teams/${teamInfo.id}/seasons`);
      const q = query(seasonsRef, orderBy('startDate', 'desc'));
      const snapshot = await getDocs(q);
      setSeasons(snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Season)));
    } catch (err) {
      console.error(err);
      setError("シーズン情報の取得に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (season?: Season) => {
    if (season) {
      setEditingSeason(season);
      setFormData({
        name: season.name,
        startDate: season.startDate.toDate().toISOString().split('T')[0],
        endDate: season.endDate.toDate().toISOString().split('T')[0],
        description: season.description || '',
      });
    } else {
      setEditingSeason(null);
      setFormData({
        name: '',
        startDate: '',
        endDate: '',
        description: '',
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingSeason(null);
    setFormData({
      name: '',
      startDate: '',
      endDate: '',
      description: '',
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!db || !teamInfo?.id) return;
    if (!formData.name.trim() || !formData.startDate || !formData.endDate) {
      setError("シーズン名、開始日、終了日は必須です。");
      return;
    }
    if (new Date(formData.startDate) > new Date(formData.endDate)) {
      setError("開始日は終了日より前である必要があります。");
      return;
    }

    try {
      if (editingSeason) {
        await updateDoc(doc(db, `teams/${teamInfo.id}/seasons/${editingSeason.id}`), {
          name: formData.name.trim(),
          startDate: Timestamp.fromDate(new Date(formData.startDate)),
          endDate: Timestamp.fromDate(new Date(formData.endDate)),
          description: formData.description.trim() || null,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, `teams/${teamInfo.id}/seasons`), {
          name: formData.name.trim(),
          startDate: Timestamp.fromDate(new Date(formData.startDate)),
          endDate: Timestamp.fromDate(new Date(formData.endDate)),
          description: formData.description.trim() || null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      handleCloseModal();
      fetchSeasons();
    } catch (err) {
      console.error(err);
      setError(editingSeason ? "シーズンの更新に失敗しました。" : "シーズンの作成に失敗しました。");
    }
  };

  const handleDelete = async (seasonId: string) => {
    if (!db || !teamInfo?.id) return;
    if (!window.confirm("このシーズンを削除しますか？関連する試合データは削除されませんが、シーズン情報は失われます。")) return;
    try {
      await deleteDoc(doc(db, `teams/${teamInfo.id}/seasons/${seasonId}`));
      fetchSeasons();
    } catch (err) {
      console.error(err);
      setError("シーズンの削除に失敗しました。");
    }
  };

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-gray-100"><p>読み込んでいます...</p></main>;
  if (error && !seasons.length) return <main className="flex min-h-screen items-center justify-center bg-gray-100"><p className="text-red-500">{error}</p></main>;

  const now = new Date();
  const isActive = (season: Season) => {
    const start = season.startDate.toDate();
    const end = season.endDate.toDate();
    return start <= now && end >= now;
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-8 bg-gray-100">
      <div className="w-full max-w-4xl space-y-8">
        <header className="flex justify-between items-center bg-white p-4 rounded-lg shadow-md">
          <h1 className="text-2xl font-bold text-gray-900">シーズン管理</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={() => handleOpenModal()}
              className="bg-green-500 text-white font-bold py-2 px-4 rounded-md hover:bg-green-600 transition-colors text-sm"
            >
              ＋ 新しいシーズン
            </button>
            <Link href="/dashboard">
              <span className="bg-blue-500 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-600 transition-colors text-sm">
                ダッシュボード
              </span>
            </Link>
          </div>
        </header>

        {error && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded"><p>{error}</p></div>}

        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">シーズン一覧</h2>
          {seasons.length === 0 ? (
            <p className="text-center text-gray-700 py-4">シーズンが登録されていません。新しいシーズンを作成してください。</p>
          ) : (
            <ul className="divide-y divide-gray-200">
              {seasons.map(season => {
                const active = isActive(season);
                return (
                  <li key={season.id} className="py-4 flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-medium text-gray-900">{season.name}</h3>
                        {active && (
                          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded">進行中</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {season.startDate.toDate().toLocaleDateString()} ～ {season.endDate.toDate().toLocaleDateString()}
                      </p>
                      {season.description && (
                        <p className="text-sm text-gray-500 mt-1">{season.description}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleOpenModal(season)}
                        className="px-3 py-1 bg-yellow-500 text-white text-xs font-semibold rounded-md hover:bg-yellow-600"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => handleDelete(season.id)}
                        className="px-3 py-1 bg-red-500 text-white text-xs font-semibold rounded-md hover:bg-red-600"
                      >
                        削除
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {isModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center p-4">
            <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
              <h2 className="text-2xl font-bold mb-6 text-gray-800">
                {editingSeason ? 'シーズンを編集' : '新しいシーズン'}
              </h2>
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">シーズン名 *</label>
                  <input
                    id="name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full border border-gray-300 p-2 rounded-md text-gray-900"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">開始日 *</label>
                  <input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full border border-gray-300 p-2 rounded-md text-gray-900"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">終了日 *</label>
                  <input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full border border-gray-300 p-2 rounded-md text-gray-900"
                    required
                  />
                </div>
                <div className="mb-6">
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">説明 (任意)</label>
                  <textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full border border-gray-300 p-2 rounded-md text-gray-900"
                    rows={3}
                  />
                </div>
                <div className="flex justify-end gap-4">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                  >
                    {editingSeason ? '更新' : '作成'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

