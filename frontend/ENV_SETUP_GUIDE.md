# 環境変数の設定ガイド

## 概要

環境変数は**ローカル開発環境**と**本番環境（Vercel）**の両方で設定する必要があります。

## 1. ローカル開発環境（`.env.local`）

### 設定場所
`frontend/.env.local` ファイルを作成または編集

### 設定方法

1. `frontend`ディレクトリに`.env.local`ファイルを作成（まだない場合）
2. 以下の内容を追加：

```env
# Firebase設定
NEXT_PUBLIC_FIREBASE_API_KEY=あなたのAPIキー
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=あなたのプロジェクトID.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=あなたのプロジェクトID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=あなたのプロジェクトID.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=あなたのMessaging Sender ID
NEXT_PUBLIC_FIREBASE_APP_ID=あなたのApp ID

# ログビューアーパスワード（オプション）
NEXT_PUBLIC_LOG_VIEWER_PASSWORD=your-secure-password

# Firebase Emulator設定（開発環境のみ、オプション）
NEXT_PUBLIC_USE_FIREBASE_EMULATOR=false
```

### Firebase Consoleから値を取得

1. Firebase Consoleにアクセス: https://console.firebase.google.com/
2. プロジェクトを選択
3. プロジェクト設定（⚙️アイコン）をクリック
4. 「マイアプリ」セクションでWebアプリの設定を確認
5. 各値をコピーして`.env.local`に貼り付け

### 注意事項

- `.env.local`ファイルは`.gitignore`に含まれているため、Gitにコミットされません
- 開発サーバーを再起動すると環境変数が読み込まれます
- 値に`your-`が含まれている場合は、実際の値に置き換えてください

## 2. 本番環境（Vercel）

### 設定場所
Vercelダッシュボード → プロジェクト → Settings → Environment Variables

### 設定方法

1. Vercelダッシュボードにアクセス: https://vercel.com/dashboard
2. プロジェクトを選択
3. 「Settings」タブをクリック
4. 左メニューから「Environment Variables」を選択
5. 「Add New」をクリック
6. 以下の環境変数を**個別に**追加：

#### 環境変数1: `NEXT_PUBLIC_FIREBASE_API_KEY`
- Key: `NEXT_PUBLIC_FIREBASE_API_KEY`
- Value: ローカルと同じAPIキー
- Environment: ✅ Production, ✅ Preview, ✅ Development

#### 環境変数2: `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- Key: `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- Value: `あなたのプロジェクトID.firebaseapp.com`
- Environment: ✅ Production, ✅ Preview, ✅ Development

#### 環境変数3: `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- Key: `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- Value: FirebaseプロジェクトID
- Environment: ✅ Production, ✅ Preview, ✅ Development

#### 環境変数4: `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- Key: `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- Value: `あなたのプロジェクトID.appspot.com`
- Environment: ✅ Production, ✅ Preview, ✅ Development

#### 環境変数5: `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- Key: `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- Value: Firebase Consoleから取得したMessaging Sender ID
- Environment: ✅ Production, ✅ Preview, ✅ Development

#### 環境変数6: `NEXT_PUBLIC_FIREBASE_APP_ID`
- Key: `NEXT_PUBLIC_FIREBASE_APP_ID`
- Value: Firebase Consoleから取得したApp ID
- Environment: ✅ Production, ✅ Preview, ✅ Development

#### オプション: `NEXT_PUBLIC_LOG_VIEWER_PASSWORD`
- Key: `NEXT_PUBLIC_LOG_VIEWER_PASSWORD`
- Value: ログビューアーのパスワード（任意）
- Environment: ✅ Production, ✅ Preview, ✅ Development

### 再デプロイ

環境変数を追加した後、**必ず再デプロイ**が必要です：

1. 「Deployments」タブに移動
2. 最新のデプロイメントの「...」メニューをクリック
3. 「Redeploy」を選択

または、新しいコミットをプッシュして自動デプロイをトリガー

## 3. 環境変数の確認方法

### ローカル環境

開発サーバーを起動して、ブラウザのコンソールでエラーが出ないか確認：

```bash
cd frontend
npm run dev
```

### 本番環境

デプロイ後、アプリにアクセスして：

1. ブラウザの開発者ツール（F12）を開く
2. Consoleタブでエラーを確認
3. `/logs`ページにアクセスしてログビューアーを確認

## トラブルシューティング

### ローカルで環境変数が読み込まれない場合

1. `.env.local`ファイルが`frontend`ディレクトリにあるか確認
2. ファイル名が正確か確認（`.env.local`）
3. 開発サーバーを再起動
4. 値に`your-`が含まれていないか確認

### 本番環境で環境変数が反映されない場合

1. 環境変数を追加した後、**再デプロイ**が必要です
2. `NEXT_PUBLIC_`プレフィックスが付いているか確認
3. Production, Preview, Developmentすべてにチェックが入っているか確認
4. 値に余分なスペースが入っていないか確認

## まとめ

- **ローカル**: `frontend/.env.local`ファイルに設定
- **本番**: Vercelダッシュボードで設定
- **両方必要**: ローカルと本番で別々に設定する必要があります

