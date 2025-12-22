import { useState, useCallback } from 'react';

interface UseRetryOptions {
  maxRetries?: number;
  retryDelay?: number;
  onRetry?: (attempt: number) => void;
  onMaxRetriesReached?: () => void;
}

export function useRetry<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: UseRetryOptions = {}
) {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    onRetry,
    onMaxRetriesReached,
  } = options;

  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const executeWithRetry = useCallback(
    async (...args: Parameters<T>): Promise<ReturnType<T>> => {
      let lastError: Error | unknown;
      
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          setIsRetrying(attempt > 0);
          setRetryCount(attempt);
          
          if (attempt > 0 && onRetry) {
            onRetry(attempt);
          }
          
          const result = await fn(...args);
          setIsRetrying(false);
          setRetryCount(0);
          return result;
        } catch (error) {
          lastError = error;
          
          if (attempt < maxRetries) {
            // 指数バックオフでリトライ
            const delay = retryDelay * Math.pow(2, attempt);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      
      setIsRetrying(false);
      setRetryCount(0);
      
      if (onMaxRetriesReached) {
        onMaxRetriesReached();
      }
      
      throw lastError;
    },
    [fn, maxRetries, retryDelay, onRetry, onMaxRetriesReached]
  );

  return {
    executeWithRetry,
    isRetrying,
    retryCount,
  };
}

