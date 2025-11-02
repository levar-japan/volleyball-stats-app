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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center animate-pulse">
            <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-gray-600 font-medium">読み込んでいます...</p>
        </div>
      </div>
    );
  }
  if (error && !seasons.length) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 flex items-center justify-center">
        <div className="bg-white p-6 rounded-xl shadow-lg border border-red-200 max-w-md">
          <p className="text-red-700 font-medium">{error}</p>
        </div>
      </div>
    );
  }

  const now = new Date();
  const isActive = (season: Season) => {
    const start = season.startDate.toDate();
    const end = season.endDate.toDate();
    return start <= now && end >= now;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="text-gray-600 hover:text-gray-900 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                シーズン管理
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleOpenModal()}
                className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all shadow-md hover:shadow-lg flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                新しいシーズン
              </button>
              <Link href="/dashboard">
                <span className="px-4 py-2 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors">
                  ダッシュボード
                </span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-red-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-700 text-sm font-medium">{error}</p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
          <h2 className="text-xl font-semibold mb-6 text-gray-900">シーズン一覧</h2>
          {seasons.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p>シーズンが登録されていません</p>
              <p className="text-sm mt-1">新しいシーズンを作成してください</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {seasons.map(season => {
                const active = isActive(season);
                return (
                  <li key={season.id} className="py-5 hover:bg-gray-50 transition-colors">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">{season.name}</h3>
                          {active && (
                            <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">進行中</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {season.startDate.toDate().toLocaleDateString()} ～ {season.endDate.toDate().toLocaleDateString()}
                        </p>
                        {season.description && (
                          <p className="text-sm text-gray-500 mt-2">{season.description}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleOpenModal(season)}
                          className="px-4 py-2 bg-amber-100 text-amber-700 text-sm font-semibold rounded-lg hover:bg-amber-200 transition-colors flex items-center gap-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          編集
                        </button>
                        <button
                          onClick={() => handleDelete(season.id)}
                          className="px-4 py-2 bg-red-100 text-red-700 text-sm font-semibold rounded-lg hover:bg-red-200 transition-colors flex items-center gap-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          削除
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center p-4 z-50">
            <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md border border-gray-200">
              <h2 className="text-2xl font-bold mb-6 text-gray-900">
                {editingSeason ? 'シーズンを編集' : '新しいシーズン'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-2">
                    シーズン名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full py-3 px-4 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="startDate" className="block text-sm font-semibold text-gray-700 mb-2">
                    開始日 <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full py-3 px-4 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="endDate" className="block text-sm font-semibold text-gray-700 mb-2">
                    終了日 <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full py-3 px-4 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="description" className="block text-sm font-semibold text-gray-700 mb-2">
                    説明 <span className="text-gray-500 text-xs">(任意)</span>
                  </label>
                  <textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full py-3 px-4 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    rows={3}
                  />
                </div>
                <div className="flex justify-end gap-4 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-lg shadow-md transition-all hover:shadow-lg"
                  >
                    {editingSeason ? '更新' : '作成'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

