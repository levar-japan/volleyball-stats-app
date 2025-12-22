# データ取得最適化フック

## useFirestoreData

ページネーション対応のFirestoreデータ取得フック。

```typescript
const { data, loading, error, hasMore, loadMore, refresh } = useFirestoreData({
  query: myQuery,
  limitCount: 50,
  enabled: true,
  dependencies: [selectedSeasonId]
});
```

### 特徴
- 自動ページネーション
- ローディング状態管理
- エラーハンドリング
- リフレッシュ機能

## useOptimizedQuery

最適化されたFirestoreクエリを生成するフック。

```typescript
const optimizedQuery = useOptimizedQuery({
  db,
  collectionPath: `teams/${teamId}/matches`,
  filters: { seasonId: 'xxx', status: 'finished' },
  orderByField: 'matchDate',
  orderDirection: 'desc',
  limitCount: 50
});
```

### 最適化のポイント
- フィルター条件の適用
- ソート順の指定
- 取得件数の制限

