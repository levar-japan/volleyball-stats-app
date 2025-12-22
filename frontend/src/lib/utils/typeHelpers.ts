import { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';

/**
 * FirestoreドキュメントにIDを追加する型安全なヘルパー関数
 */
export function withId<T extends DocumentData>(
  snap: QueryDocumentSnapshot<T>
): T & { id: string } {
  return {
    id: snap.id,
    ...snap.data(),
  } as T & { id: string };
}

/**
 * 型ガード: オブジェクトが特定のプロパティを持つかチェック
 */
export function hasProperty<T extends string>(
  obj: unknown,
  prop: T
): obj is Record<T, unknown> {
  return typeof obj === 'object' && obj !== null && prop in obj;
}

/**
 * 型ガード: 文字列が特定の値のいずれかかチェック
 */
export function isOneOf<T extends string>(
  value: string,
  options: readonly T[]
): value is T {
  return options.includes(value as T);
}

/**
 * 安全に型アサーションを行う
 */
export function safeAssert<T>(
  value: unknown,
  predicate: (val: unknown) => boolean,
  errorMessage?: string
): asserts value is T {
  if (!predicate(value)) {
    throw new Error(errorMessage || '型アサーションに失敗しました');
  }
}

