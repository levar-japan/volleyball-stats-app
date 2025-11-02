# デプロイガイド

このガイドでは、バレーボール統計アプリを本番環境にデプロイする方法を説明します。

## 📋 前提条件

- Node.js 18以上がインストールされていること
- Firebaseプロジェクトが作成済みであること
- Gitがインストールされていること（推奨）

## 🚀 デプロイ方法の選択

### 方法1: Vercel（推奨・最も簡単）

VercelはNext.jsアプリケーションのデプロイに最適化されており、最も簡単にデプロイできます。

#### 手順

1. **Vercelアカウントの作成**
   - [Vercel](https://vercel.com)にアクセスしてアカウントを作成
   - GitHub/GitLab/Bitbucketと連携（推奨）

2. **プロジェクトをインポート**
   ```bash
   # Vercel CLIを使用する場合
   npm i -g vercel
   cd frontend
   vercel
   ```

3. **環境変数の設定**
   
   Vercelダッシュボードで以下の環境変数を設定：

   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=あなたのAPIキー
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=あなたのプロジェクトID.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=あなたのプロジェクトID
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=あなたのプロジェクトID.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=あなたのMessaging Sender ID
   NEXT_PUBLIC_FIREBASE_APP_ID=あなたのApp ID
   ```

4. **Firebase設定の確認**
   - Firebase Console → Project Settings → General
   - 「Your apps」セクションからWebアプリの設定を確認

5. **デプロイ**
   - Gitリポジトリにプッシュすると自動デプロイ
   - または `vercel --prod` で手動デプロイ

#### メリット
- ✅ 自動HTTPS
- ✅ 自動スケーリング
- ✅ プレビュー環境（PRごと）
- ✅ 無料プランあり
- ✅ Next.jsに最適化

---

### 方法2: Firebase Hosting

Firebaseプロジェクトと統合してホスティングする場合。

#### 手順

1. **Firebase CLIのインストール**
   ```bash
   npm install -g firebase-tools
   firebase login
   ```

2. **Firebase Hostingの初期化**
   ```bash
   cd frontend
   firebase init hosting
   ```
   
   設定項目：
   - What do you want to use as your public directory? → `.next`
   - Configure as a single-page app? → No
   - Set up automatic builds and deploys with GitHub? → 任意

3. **Next.jsのビルド設定**

   `frontend/package.json`にビルドスクリプトがあることを確認：
   ```json
   {
     "scripts": {
       "build": "next build",
       "export": "next export"
     }
   }
   ```

   **注意**: Next.js 13+ (App Router)では静的エクスポートの制限があります。
   動的ルーティングを使用している場合は、Firebase Functionsと組み合わせる必要があります。

4. **環境変数の設定**

   `.env.local`ファイルを作成（Gitにはコミットしない）:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=あなたのAPIキー
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=あなたのプロジェクトID.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=あなたのプロジェクトID
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=あなたのプロジェクトID.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=あなたのMessaging Sender ID
   NEXT_PUBLIC_FIREBASE_APP_ID=あなたのApp ID
   ```

5. **firebase.jsonの設定**

   ルートディレクトリに`firebase.json`を作成/更新：
   ```json
   {
     "hosting": {
       "public": "frontend/out",
       "ignore": [
         "firebase.json",
         "**/.*",
         "**/node_modules/**"
       ],
       "rewrites": [
         {
           "source": "**",
           "destination": "/index.html"
         }
       ]
     }
   }
   ```

6. **ビルドとデプロイ**
   ```bash
   cd frontend
   npm run build
   # Next.js 13+ App Routerの場合、静的エクスポートは制限があります
   # 動的ルーティングが必要な場合は、Firebase Functionsを使用してください
   
   cd ..
   firebase deploy --only hosting
   ```

#### 注意事項
- ⚠️ Next.js App Routerは完全な静的エクスポートをサポートしていません
- 動的ルーティングが必要な場合はFirebase Functionsが必要です
- Vercelの方がNext.jsアプリには適しています

---

### 方法3: Docker + クラウドホスティング

Dockerコンテナとしてデプロイする場合。

#### 手順

1. **環境変数の設定**

   `.env`ファイルを作成（または本番環境で環境変数を設定）：
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=あなたのAPIキー
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=あなたのプロジェクトID.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=あなたのプロジェクトID
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=あなたのプロジェクトID.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=あなたのMessaging Sender ID
   NEXT_PUBLIC_FIREBASE_APP_ID=あなたのApp ID
   NODE_ENV=production
   ```

2. **Dockerビルドと実行**
   ```bash
   cd frontend
   docker build -f Dockerfile.prod -t volleyball-stats-app .
   docker run -p 3000:3000 --env-file .env volleyball-stats-app
   ```

3. **クラウドサービスへのデプロイ**

   - **Google Cloud Run**
     ```bash
     gcloud run deploy volleyball-stats-app \
       --source . \
       --platform managed \
       --region us-central1 \
       --allow-unauthenticated
     ```

   - **AWS App Runner / ECS**
     - Dockerfileを使用してECS/Fargateにデプロイ
   
   - **Azure Container Instances**
     - Azure CLIを使用してデプロイ

---

## 🔐 環境変数の取得方法

1. Firebase Consoleにログイン
2. プロジェクトを選択
3. ⚙️ 設定 → プロジェクトの設定
4. 「マイアプリ」セクションで「</>」アイコンをクリック
5. 設定値をコピー

または、`frontend/src/lib/firebase.ts`で使用されている環境変数を確認：

```typescript
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
```

## 🔒 セキュリティチェックリスト

デプロイ前に以下を確認してください：

- [ ] 環境変数が正しく設定されている
- [ ] `.env`ファイルがGitにコミットされていない（`.gitignore`に追加）
- [ ] Firebase Firestoreのセキュリティルールが適切に設定されている
- [ ] Firebase Authenticationが有効になっている
- [ ] 本番環境用のFirebaseプロジェクトを使用している（開発用と分離）

## 📝 Firestoreセキュリティルールの確認

`firebase/firestore.rules`を確認し、本番環境に適したルールを設定してください。

本番環境にデプロイする場合：
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 適切なアクセス制御を設定
    match /teams/{teamId}/{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

デプロイ：
```bash
firebase deploy --only firestore:rules
```

## 🚨 トラブルシューティング

### 問題1: 環境変数が読み込まれない

**解決策:**
- 環境変数名が`NEXT_PUBLIC_`で始まっているか確認
- デプロイ後に環境変数を再設定
- ブラウザのキャッシュをクリア

### 問題2: Firebase認証エラー

**解決策:**
- Firebase ConsoleでAuthenticationが有効になっているか確認
- 匿名認証が有効になっているか確認
- 許可されたドメインに本番URLが追加されているか確認

### 問題3: ビルドエラー

**解決策:**
- `npm install`を実行
- `npm run build`でローカルでビルドを確認
- TypeScriptエラーを修正

### 問題4: 静的エクスポートエラー（Firebase Hosting）

**解決策:**
- Next.js App Routerを使用している場合、Vercelを推奨
- またはFirebase Functionsと組み合わせる

## 📊 デプロイ後の確認事項

1. ✅ アプリが正常に表示される
2. ✅ 認証が機能する
3. ✅ データの読み書きが機能する
4. ✅ 統計分析ページが表示される
5. ✅ シーズン管理が機能する

## 🔄 継続的デプロイの設定

### GitHub Actions（推奨）

`.github/workflows/deploy.yml`を作成：

```yaml
name: Deploy to Vercel

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
          working-directory: ./frontend
```

## 📚 参考リンク

- [Vercel Documentation](https://vercel.com/docs)
- [Firebase Hosting Documentation](https://firebase.google.com/docs/hosting)
- [Next.js Deployment Documentation](https://nextjs.org/docs/deployment)
- [Docker Documentation](https://docs.docker.com/)

---

## 🎯 推奨デプロイフロー

1. **開発**: ローカル環境で`npm run dev`
2. **テスト**: ローカルビルド`npm run build`で確認
3. **デプロイ**: Vercel（推奨）またはFirebase Hosting
4. **監視**: エラーログとパフォーマンスを監視

最も簡単で推奨される方法は**Vercel**です。Next.jsアプリケーションに最適化されており、数分でデプロイできます。

