"use client";
import { useState, useEffect } from 'react';
import { LogViewer } from './LogViewer';
import { LogViewerAuth } from './LogViewerAuth';

export function LogViewerButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // 認証状態をチェック
  useEffect(() => {
    const authStatus = sessionStorage.getItem('log_viewer_authenticated');
    setIsAuthenticated(authStatus === 'true');
  }, []);

  const handleOpen = () => {
    if (isAuthenticated) {
      setIsOpen(true);
    } else {
      setShowAuth(true);
    }
  };

  const handleAuthenticated = () => {
    setIsAuthenticated(true);
    setShowAuth(false);
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    // セッション終了時に認証状態をクリア（オプション）
    // sessionStorage.removeItem('log_viewer_authenticated');
  };

  // パスワードが設定されている場合のみ表示
  const passwordSet = process.env.NEXT_PUBLIC_LOG_VIEWER_PASSWORD || 
    (process.env.NODE_ENV === 'development' ? 'dev123' : null);

  if (!passwordSet) {
    return null;
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="fixed bottom-4 right-4 z-40 bg-indigo-600 text-white p-3 rounded-full shadow-lg hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        aria-label="ログビューアーを開く"
        title="ログビューアー"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      </button>
      {showAuth && (
        <LogViewerAuth
          onAuthenticated={handleAuthenticated}
          onCancel={() => setShowAuth(false)}
        />
      )}
      <LogViewer isOpen={isOpen} onClose={handleClose} />
    </>
  );
}

