# デプロイガイド

## Vercelへのデプロイ（推奨）

### 1. Vercelアカウントの作成

1. [Vercel](https://vercel.com/)にアクセス
2. 「Sign Up」をクリック
3. GitHubアカウントでサインアップ（推奨）

### 2. GitHubリポジトリの準備

1. GitHubにリポジトリを作成（まだの場合）
2. ローカルの変更をコミット・プッシュ：

```powershell
git add .
git commit -m "デプロイ準備"
git push origin main
```

### 3. Vercelでプロジェクトをインポート

1. Vercelダッシュボードで「Add New Project」をクリック
2. GitHubリポジトリを選択
3. プロジェクト設定：
   - **Framework Preset**: Next.js（自動検出）
   - **Root Directory**: `frontend` に設定
   - **Build Command**: `npm run build`（自動設定）
   - **Output Directory**: `.next`（自動設定）
   - **Install Command**: `npm install`（自動設定）

### 4. 環境変数の設定

Vercelダッシュボードで以下の環境変数を設定：

1. プロジェクト設定 → 「Environment Variables」
2. 以下の変数を追加：

```
NEXT_PUBLIC_FIREBASE_API_KEY=あなたのAPIキー
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=あなたのプロジェクトID.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=あなたのプロジェクトID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=あなたのプロジェクトID.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=あなたのMessaging Sender ID
NEXT_PUBLIC_FIREBASE_APP_ID=あなたのApp ID
```

**重要**: 
- 各環境（Production, Preview, Development）に設定
- `NEXT_PUBLIC_`で始まる変数は自動的にブラウザに公開されます

### 5. デプロイ

1. 「Deploy」をクリック
2. ビルドが完了するまで待機（通常1-3分）
3. デプロイ完了後、URLが表示されます

### 6. Firestoreセキュリティルールの設定

本番環境用のセキュリティルールを設定：

1. Firebase Console → Firestore Database
2. 「ルール」タブを開く
3. 適切なセキュリティルールを設定

### 7. カスタムドメインの設定（オプション）

1. Vercelダッシュボード → Settings → Domains
2. ドメインを追加
3. DNS設定を完了

## トラブルシューティング

### ビルドエラーが発生する場合

1. ローカルでビルドが成功するか確認：
   ```powershell
   cd frontend
   npm run build
   ```

2. 環境変数が正しく設定されているか確認

3. Vercelのビルドログを確認

### 環境変数が読み込まれない場合

- `NEXT_PUBLIC_`プレフィックスが付いているか確認
- 環境変数を設定後、再デプロイが必要

### Firebase接続エラー

- Firebase Consoleでプロジェクトが正しく設定されているか確認
- Firestore Databaseが作成されているか確認
- Authenticationが有効になっているか確認

## 継続的デプロイ（CI/CD）

GitHubにプッシュすると自動的にデプロイされます：

- `main`ブランチへのプッシュ → Production環境にデプロイ
- その他のブランチへのプッシュ → Preview環境にデプロイ

## 参考リンク

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Firebase Setup Guide](./FIREBASE_SETUP.md)

