"use client";
import { useState, useEffect, useMemo } from 'react';
import { logger, LogEntry, LogLevel } from '@/lib/logger';
import { useRouter } from 'next/navigation';

export default function LogsPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filterLevel, setFilterLevel] = useState<LogLevel | 'all'>('all');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // ログを読み込む
  useEffect(() => {
    const loadLogs = () => {
      const allLogs = logger.getLogs();
      setLogs(allLogs);
    };

    loadLogs();

    if (autoRefresh) {
      const interval = setInterval(loadLogs, 1000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const filteredLogs = useMemo(() => {
    let filtered = logs;

    if (filterLevel !== 'all') {
      filtered = filtered.filter(log => log.level === filterLevel);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(log =>
        log.message.toLowerCase().includes(query) ||
        log.stack?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [logs, filterLevel, searchQuery]);

  const levelColors: Record<LogLevel, string> = {
    log: 'text-gray-600 bg-gray-50',
    info: 'text-blue-600 bg-blue-50',
    warn: 'text-amber-600 bg-amber-50',
    error: 'text-red-600 bg-red-50',
  };

  const levelIcons: Record<LogLevel, string> = {
    log: '📝',
    info: 'ℹ️',
    warn: '⚠️',
    error: '❌',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/')}
                className="text-gray-600 hover:text-gray-900 transition-colors"
                aria-label="ホームに戻る"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <h1 className="text-xl font-bold text-gray-900">ログビューアー</h1>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                  autoRefresh
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {autoRefresh ? '自動更新 ON' : '自動更新 OFF'}
              </button>
              <button
                onClick={() => logger.clearLogs()}
                className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
              >
                クリア
              </button>
              <button
                onClick={() => logger.downloadLogs()}
                className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
              >
                ダウンロード
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* フィルター */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">レベル:</label>
              <select
                value={filterLevel}
                onChange={(e) => setFilterLevel(e.target.value as LogLevel | 'all')}
                className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">すべて</option>
                <option value="log">Log</option>
                <option value="info">Info</option>
                <option value="warn">Warn</option>
                <option value="error">Error</option>
              </select>
            </div>
            <div className="flex-1">
              <input
                type="text"
                placeholder="ログを検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="text-sm text-gray-600">
              {filteredLogs.length} / {logs.length} 件
            </div>
          </div>
        </div>
      </div>

      {/* ログリスト */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="space-y-3">
          {filteredLogs.length === 0 ? (
            <div className="text-center text-gray-500 py-12 bg-white rounded-lg border border-gray-200">
              ログがありません
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className={`p-4 rounded-lg border border-gray-200 ${levelColors[log.level]}`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl">{levelIcons[log.level]}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-gray-500">
                        {log.timestamp.toLocaleTimeString()}
                      </span>
                      <span className="text-xs font-semibold uppercase">
                        {log.level}
                      </span>
                    </div>
                    <div className="text-sm break-words font-mono">{log.message}</div>
                    {log.stack && (
                      <details className="mt-2">
                        <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-800">
                          スタックトレースを表示
                        </summary>
                        <pre className="mt-2 p-3 bg-gray-900 text-gray-100 text-xs rounded overflow-x-auto">
                          {log.stack}
                        </pre>
                      </details>
                    )}
                    {log.data && log.data.length > 1 && (
                      <details className="mt-2">
                        <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-800">
                          データを表示 ({log.data.length}件)
                        </summary>
                        <pre className="mt-2 p-3 bg-gray-900 text-gray-100 text-xs rounded overflow-x-auto">
                          {JSON.stringify(log.data, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}

