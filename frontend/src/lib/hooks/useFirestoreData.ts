import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Query, 
  QueryConstraint, 
  getDocs, 
  query,
  limit,
  startAfter,
  QueryDocumentSnapshot
} from 'firebase/firestore';

interface UseFirestoreDataOptions<T> {
  query: Query<T>;
  limitCount?: number;
  enabled?: boolean;
  dependencies?: unknown[];
}

interface UseFirestoreDataResult<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Firestoreデータを効率的に取得するカスタムフック
 * ページネーション対応
 */
export function useFirestoreData<T extends { id: string }>(
  options: UseFirestoreDataOptions<T>
): UseFirestoreDataResult<T> {
  const { query: baseQuery, limitCount = 50, enabled = true, dependencies = [] } = options;
  
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const lastDocRef = useRef<QueryDocumentSnapshot<T> | null>(null);
  const isInitialLoadRef = useRef(true);

  const fetchData = useCallback(async (isLoadMore = false) => {
    if (!enabled) return;
    
    try {
      setLoading(true);
      setError(null);

      const constraints: QueryConstraint[] = [limit(limitCount)];
      if (isLoadMore && lastDocRef.current) {
        constraints.push(startAfter(lastDocRef.current));
      }

      const q = query(baseQuery, ...constraints);
      const snapshot = await getDocs(q);

      const newData = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      } as T));

      if (isLoadMore) {
        setData(prev => [...prev, ...newData]);
      } else {
        setData(newData);
        isInitialLoadRef.current = false;
      }

      // 最後のドキュメントを保存
      if (snapshot.docs.length > 0) {
        lastDocRef.current = snapshot.docs[snapshot.docs.length - 1] as QueryDocumentSnapshot<T>;
      }

      // 取得したデータがlimit未満なら、これ以上データがない
      setHasMore(snapshot.docs.length === limitCount);
    } catch (err) {
      console.error('Firestoreデータ取得エラー:', err);
      setError(err instanceof Error ? err.message : 'データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [baseQuery, limitCount, enabled]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loading) return;
    await fetchData(true);
  }, [hasMore, loading, fetchData]);

  const refresh = useCallback(async () => {
    lastDocRef.current = null;
    await fetchData(false);
  }, [fetchData]);

  useEffect(() => {
    if (enabled && isInitialLoadRef.current) {
      fetchData(false);
    }
  }, [enabled, fetchData, ...dependencies]);

  return {
    data,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
  };
}

