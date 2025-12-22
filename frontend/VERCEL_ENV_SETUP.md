# Vercel環境変数の設定方法

## 本番環境でFirebase環境変数を設定する

### 1. Vercelダッシュボードにアクセス

1. https://vercel.com/dashboard にアクセス
2. プロジェクトを選択

### 2. 環境変数を設定

1. プロジェクトの「Settings」タブをクリック
2. 左メニューから「Environment Variables」を選択
3. 以下の環境変数を追加：

#### 必須のFirebase環境変数

```
NEXT_PUBLIC_FIREBASE_API_KEY=あなたのAPIキー
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=あなたのプロジェクトID.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=あなたのプロジェクトID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=あなたのプロジェクトID.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=あなたのMessaging Sender ID
NEXT_PUBLIC_FIREBASE_APP_ID=あなたのApp ID
```

#### オプションの環境変数

```
NEXT_PUBLIC_LOG_VIEWER_PASSWORD=ログビューアーのパスワード（任意）
NEXT_PUBLIC_USE_FIREBASE_EMULATOR=false（本番環境ではfalse）
```

### 3. 環境変数の取得方法

Firebase Consoleから取得：

1. Firebase Consoleにアクセス: https://console.firebase.google.com/
2. プロジェクトを選択
3. プロジェクト設定（⚙️アイコン）をクリック
4. 「マイアプリ」セクションでWebアプリの設定を確認
5. 以下の値をコピー：
   - `apiKey` → `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `authDomain` → `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `projectId` → `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `storageBucket` → `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `messagingSenderId` → `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `appId` → `NEXT_PUBLIC_FIREBASE_APP_ID`

### 4. 環境変数の適用先を選択

各環境変数を追加する際に、以下の環境を選択：

- ✅ **Production**（本番環境）
- ✅ **Preview**（プレビュー環境）
- ✅ **Development**（開発環境）

### 5. 再デプロイ

環境変数を追加した後：

1. 「Deployments」タブに移動
2. 最新のデプロイメントの「...」メニューをクリック
3. 「Redeploy」を選択
4. または、新しいコミットをプッシュして自動デプロイをトリガー

### 6. 確認方法

デプロイ後、アプリにアクセスして：

1. ブラウザの開発者ツール（F12）を開く
2. Consoleタブでエラーが消えているか確認
3. ログビューアー（右下のアイコン）でエラーを確認

## トラブルシューティング

### 環境変数が反映されない場合

1. **再デプロイが必要**: 環境変数を追加した後は必ず再デプロイが必要です
2. **`NEXT_PUBLIC_`プレフィックス**: ブラウザで使用する変数には`NEXT_PUBLIC_`が必要です
3. **値の確認**: コピー&ペースト時に余分なスペースが入っていないか確認

### Firebase接続エラーが続く場合

1. **Firestore Databaseの作成**: Firebase ConsoleでFirestore Databaseが作成されているか確認
2. **セキュリティルール**: Firestoreのセキュリティルールが正しく設定されているか確認
3. **匿名認証**: Authenticationで匿名認証が有効になっているか確認

## 参考リンク

- [Vercel環境変数のドキュメント](https://vercel.com/docs/concepts/projects/environment-variables)
- [Firebase Console](https://console.firebase.google.com/)

