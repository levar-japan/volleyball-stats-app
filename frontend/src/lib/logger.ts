/**
 * ログ管理ユーティリティ
 * 本番環境ではconsole.logを無効化し、エラーのみ記録
 */

export type LogLevel = 'log' | 'info' | 'warn' | 'error';

export interface LogEntry {
  id: string;
  level: LogLevel;
  message: string;
  timestamp: Date;
  data?: unknown[];
  stack?: string;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private logs: LogEntry[] = [];
  private maxLogs = 1000; // 最大保持ログ数
  private storageKey = 'app_logs';

  constructor() {
    // ローカルストレージからログを復元（開発環境のみ）
    if (this.isDevelopment && typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(this.storageKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          this.logs = parsed.map((log: any) => ({
            ...log,
            timestamp: new Date(log.timestamp),
          }));
        }
      } catch (e) {
        // ストレージの読み込みエラーは無視
      }
    }
  }

  private shouldLog(level: LogLevel): boolean {
    if (this.isDevelopment) return true;
    // 本番環境ではエラーのみ記録
    return level === 'error';
  }

  private addLog(level: LogLevel, ...args: unknown[]): void {
    const id = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const message = args.map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');

    const entry: LogEntry = {
      id,
      level,
      message,
      timestamp: new Date(),
      data: args.length > 1 ? args : undefined,
    };

    // エラーの場合はスタックトレースを追加
    if (args[0] instanceof Error) {
      entry.stack = args[0].stack;
      entry.message = args[0].message;
    }

    this.logs.push(entry);

    // 最大ログ数を超えた場合は古いログを削除
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // ローカルストレージに保存（開発環境のみ）
    if (this.isDevelopment && typeof window !== 'undefined') {
      try {
        localStorage.setItem(this.storageKey, JSON.stringify(this.logs));
      } catch (e) {
        // ストレージの保存エラーは無視
      }
    }
  }

  log(...args: unknown[]): void {
    this.addLog('log', ...args);
    if (this.shouldLog('log')) {
      console.log('[LOG]', ...args);
    }
  }

  info(...args: unknown[]): void {
    this.addLog('info', ...args);
    if (this.shouldLog('info')) {
      console.info('[INFO]', ...args);
    }
  }

  warn(...args: unknown[]): void {
    this.addLog('warn', ...args);
    if (this.shouldLog('warn')) {
      console.warn('[WARN]', ...args);
    }
  }

  error(...args: unknown[]): void {
    this.addLog('error', ...args);
    // エラーは常に記録
    console.error('[ERROR]', ...args);
    
    // 本番環境ではエラートラッキングサービスに送信（必要に応じて実装）
    if (!this.isDevelopment) {
      // TODO: Sentryなどのエラートラッキングサービスに送信
      // Sentry.captureException(new Error(args.join(' ')));
    }
  }

  /**
   * ログを取得
   */
  getLogs(level?: LogLevel, limit?: number): LogEntry[] {
    let filtered = this.logs;
    if (level) {
      filtered = filtered.filter(log => log.level === level);
    }
    if (limit) {
      filtered = filtered.slice(-limit);
    }
    return [...filtered].reverse(); // 新しい順に
  }

  /**
   * ログをクリア
   */
  clearLogs(): void {
    this.logs = [];
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(this.storageKey);
      } catch (e) {
        // ストレージの削除エラーは無視
      }
    }
  }

  /**
   * ログをエクスポート（JSON形式）
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * ログをダウンロード
   */
  downloadLogs(): void {
    const data = this.exportLogs();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export const logger = new Logger();
