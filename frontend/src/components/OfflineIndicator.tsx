"use client";
import { useFirebase } from '@/app/FirebaseProvider';
import { useEffect, useState } from 'react';

export function OfflineIndicator() {
  const { isOnline, isFirestoreSynced } = useFirebase();
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setShowBanner(true);
    } else if (isFirestoreSynced) {
      // オンライン復帰後、同期が完了したら少し遅延してバナーを非表示
      const timer = setTimeout(() => {
        setShowBanner(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, isFirestoreSynced]);

  if (!showBanner && isOnline && isFirestoreSynced) {
    return null;
  }

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 p-3 text-center text-white font-semibold shadow-md transition-all duration-300 ${
        !isOnline
          ? 'bg-orange-500'
          : !isFirestoreSynced
          ? 'bg-yellow-500'
          : 'bg-green-500'
      }`}
      role="alert"
      aria-live="polite"
    >
      {!isOnline ? (
        <div className="flex items-center justify-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
          </svg>
          <span>オフラインです。記録はローカルに保存され、接続復帰時に自動的に同期されます。</span>
        </div>
      ) : !isFirestoreSynced ? (
        <div className="flex items-center justify-center gap-2">
          <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>同期中... 記録をサーバーに送信しています。</span>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>すべての記録が同期されました。</span>
        </div>
      )}
    </div>
  );
}

