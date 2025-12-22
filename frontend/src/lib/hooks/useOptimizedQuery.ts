import { useMemo } from 'react';
import { 
  Firestore, 
  CollectionReference, 
  Query, 
  collection,
  query, 
  where, 
  orderBy, 
  limit,
  Timestamp
} from 'firebase/firestore';

interface UseOptimizedQueryOptions {
  db: Firestore | null;
  collectionPath: string;
  filters?: {
    seasonId?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
  };
  orderByField?: string;
  orderDirection?: 'asc' | 'desc';
  limitCount?: number;
}

/**
 * 最適化されたFirestoreクエリを生成するカスタムフック
 */
export function useOptimizedQuery(
  options: UseOptimizedQueryOptions
): Query | null {
  const {
    db,
    collectionPath,
    filters = {},
    orderByField = 'createdAt',
    orderDirection = 'desc',
    limitCount = 100,
  } = options;

  return useMemo(() => {
    if (!db) return null;

    try {
      // パスを解析してコレクション参照を生成
      const pathParts = collectionPath.split('/');
      let collectionRef: CollectionReference;
      
      if (pathParts.length === 1) {
        // 単純なコレクション
        collectionRef = collection(db, pathParts[0]);
      } else {
        // サブコレクション（例: teams/{teamId}/matches）
        // この実装は簡易版。実際の使用時は適切にパスを構築する必要がある
        collectionRef = collection(db, pathParts[0], pathParts[1], ...pathParts.slice(2)) as CollectionReference;
      }

      const constraints: any[] = [];

      // フィルターを適用
      if (filters.seasonId) {
        constraints.push(where('seasonId', '==', filters.seasonId));
      }
      if (filters.status) {
        constraints.push(where('status', '==', filters.status));
      }
      if (filters.startDate) {
        constraints.push(where(orderByField, '>=', Timestamp.fromDate(filters.startDate)));
      }
      if (filters.endDate) {
        constraints.push(where(orderByField, '<=', Timestamp.fromDate(filters.endDate)));
      }

      // ソート
      constraints.push(orderBy(orderByField, orderDirection));

      // リミット
      if (limitCount > 0) {
        constraints.push(limit(limitCount));
      }

      return query(collectionRef, ...constraints);
    } catch (error) {
      console.error('クエリ生成エラー:', error);
      return null;
    }
  }, [db, collectionPath, JSON.stringify(filters), orderByField, orderDirection, limitCount]);
}

