"use client";
import { useState, FormEvent } from 'react';

interface LogViewerAuthProps {
  onAuthenticated: () => void;
  onCancel: () => void;
}

export function LogViewerAuth({ onAuthenticated, onCancel }: LogViewerAuthProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // パスワードは環境変数から取得（デフォルトは開発用）
  const correctPassword = process.env.NEXT_PUBLIC_LOG_VIEWER_PASSWORD || 'dev123';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // 簡単な遅延を追加してブルートフォース攻撃を防ぐ
    await new Promise(resolve => setTimeout(resolve, 500));

    if (password === correctPassword) {
      // セッションストレージに認証状態を保存
      sessionStorage.setItem('log_viewer_authenticated', 'true');
      onAuthenticated();
    } else {
      setError('パスワードが正しくありません');
      setPassword('');
    }

    setIsLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md border border-gray-200">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">ログビューアー認証</h2>
              <p className="text-sm text-gray-600">パスワードを入力してください</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                パスワード
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="パスワードを入力"
                autoFocus
                required
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={isLoading || !password}
                className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {isLoading ? '確認中...' : '認証'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

