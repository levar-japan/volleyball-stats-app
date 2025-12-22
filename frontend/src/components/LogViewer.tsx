"use client";
import { useState, useEffect, useMemo } from 'react';
import { logger, LogEntry, LogLevel } from '@/lib/logger';

interface LogViewerProps {
  isOpen: boolean;
  onClose: () => void;
}

// 認証チェック
function checkAuth(): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem('log_viewer_authenticated') === 'true';
}

export function LogViewer({ isOpen, onClose }: LogViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filterLevel, setFilterLevel] = useState<LogLevel | 'all'>('all');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    const loadLogs = () => {
      const allLogs = logger.getLogs();
      setLogs(allLogs);
    };

    loadLogs();

    if (autoRefresh) {
      const interval = setInterval(loadLogs, 1000);
      return () => clearInterval(interval);
    }
  }, [isOpen, autoRefresh]);

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

  // 認証チェック
  useEffect(() => {
    if (isOpen && !checkAuth()) {
      onClose();
    }
  }, [isOpen, onClose]);

  if (!isOpen || !checkAuth()) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">ログビューアー</h2>
          <div className="flex items-center gap-2">
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
            <button
              onClick={onClose}
              className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              閉じる
            </button>
          </div>
        </div>

        {/* フィルター */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
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

        {/* ログリスト */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredLogs.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              ログがありません
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className={`p-3 rounded-lg border border-gray-200 ${levelColors[log.level]}`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-lg">{levelIcons[log.level]}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-gray-500">
                        {log.timestamp.toLocaleTimeString()}
                      </span>
                      <span className="text-xs font-semibold uppercase">
                        {log.level}
                      </span>
                    </div>
                    <div className="text-sm break-words">{log.message}</div>
                    {log.stack && (
                      <details className="mt-2">
                        <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-800">
                          スタックトレースを表示
                        </summary>
                        <pre className="mt-2 p-2 bg-gray-900 text-gray-100 text-xs rounded overflow-x-auto">
                          {log.stack}
                        </pre>
                      </details>
                    )}
                    {log.data && log.data.length > 1 && (
                      <details className="mt-2">
                        <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-800">
                          データを表示 ({log.data.length}件)
                        </summary>
                        <pre className="mt-2 p-2 bg-gray-900 text-gray-100 text-xs rounded overflow-x-auto">
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
      </div>
    </div>
  );
}

