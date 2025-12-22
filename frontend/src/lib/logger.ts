/**
 * ログ管理ユーティリティ
 * 本番環境ではconsole.logを無効化し、エラーのみ記録
 */

type LogLevel = 'log' | 'info' | 'warn' | 'error';

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';

  private shouldLog(level: LogLevel): boolean {
    if (this.isDevelopment) return true;
    // 本番環境ではエラーのみ記録
    return level === 'error';
  }

  log(...args: unknown[]): void {
    if (this.shouldLog('log')) {
      console.log('[LOG]', ...args);
    }
  }

  info(...args: unknown[]): void {
    if (this.shouldLog('info')) {
      console.info('[INFO]', ...args);
    }
  }

  warn(...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      console.warn('[WARN]', ...args);
    }
  }

  error(...args: unknown[]): void {
    // エラーは常に記録
    console.error('[ERROR]', ...args);
    
    // 本番環境ではエラートラッキングサービスに送信（必要に応じて実装）
    if (!this.isDevelopment) {
      // TODO: Sentryなどのエラートラッキングサービスに送信
      // Sentry.captureException(new Error(args.join(' ')));
    }
  }
}

export const logger = new Logger();

