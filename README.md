# バレーボール統計記録アプリ 🏐

Next.jsとFirebaseを使用したバレーボールの試合統計を記録・分析するアプリケーションです。

## 機能

- ✅ **試合管理**: 試合の作成、記録、編集、削除
- ✅ **選手管理**: 選手の追加、編集、削除
- ✅ **リアルタイム記録**: プレーのリアルタイム記録（サーブ、アタック、ブロック、レセプションなど）
- ✅ **セット管理**: セットごとのスコア管理とロスター設定
- ✅ **統計分析**: 
  - 選手別パフォーマンス推移グラフ
  - セットごとのスコア推移
  - チーム全体パフォーマンス推移
  - 弱点分析
  - チーム全体統計
- ✅ **シーズン管理**: シーズンの作成・管理
- ✅ **統計表示**: Vリーグ準拠、効果率、本数の3つの表示モード

## 技術スタック

- **フロントエンド**: Next.js 15 (App Router), React 19, TypeScript
- **UI**: Tailwind CSS
- **バックエンド**: Firebase (Firestore, Authentication)
- **グラフ**: Recharts
- **スタイリング**: Tailwind CSS

## セットアップ

### 前提条件

- Node.js 18以上
- npmまたはyarn
- Firebaseプロジェクト

### インストール

1. リポジトリをクローン

```bash
git clone https://github.com/あなたのユーザー名/volleyball-stats-app.git
cd volleyball-stats-app
```

2. 依存関係をインストール

```bash
cd frontend
npm install
```

3. 環境変数を設定

`.env`ファイルを`frontend`ディレクトリに作成：

```env
NEXT_PUBLIC_FIREBASE_API_KEY=あなたのAPIキー
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=あなたのプロジェクトID.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=あなたのプロジェクトID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=あなたのプロジェクトID.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=あなたのMessaging Sender ID
NEXT_PUBLIC_FIREBASE_APP_ID=あなたのApp ID
```

環境変数はFirebase Consoleから取得：
1. Firebase Console → プロジェクト設定
2. 「マイアプリ」セクション → Webアプリの設定をコピー

4. 開発サーバーを起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開きます。

## Firebase設定

### Firestoreセキュリティルール

`firebase/firestore.rules`を確認し、適切なセキュリティルールを設定してください。

### Authentication

Firebase Consoleで匿名認証を有効にしてください：
1. Firebase Console → Authentication
2. サインイン方法 → 匿名 → 有効にする

## プロジェクト構造

```
volleyball-stats-app/
├── frontend/
│   ├── src/
│   │   ├── app/              # Next.js App Router
│   │   │   ├── analytics/    # 統計分析ページ
│   │   │   ├── dashboard/    # ダッシュボード
│   │   │   ├── matches/      # 試合関連ページ
│   │   │   └── seasons/      # シーズン管理ページ
│   │   └── lib/
│   │       └── firebase.ts    # Firebase設定
│   └── package.json
├── firebase/
│   ├── firestore.rules       # Firestoreセキュリティルール
│   └── firebase.json         # Firebase設定
├── DEPLOYMENT_GUIDE.md       # デプロイガイド
├── GITHUB_SETUP.md          # GitHubセットアップガイド
└── README.md                 # このファイル
```

## 使用方法

### 1. チームに参加

- 4桁のチームコードを入力してチームに参加

### 2. 選手の登録

- ダッシュボードから選手を追加

### 3. 試合の作成

- 「新しい試合」から試合を作成
- 対戦相手、試合日、シーズンを設定

### 4. 試合記録

- 試合ページでプレーを記録
- セットごとにロスターを設定
- リアルタイムでスコアが更新

### 5. 統計分析

- 「統計分析」ページで各種統計を確認
- 選手別、チーム全体の推移をグラフで確認

## デプロイ

詳細は[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)を参照してください。

### Vercel（推奨）

1. Vercelアカウントを作成
2. GitHubリポジトリをインポート
3. 環境変数を設定
4. 自動デプロイ完了

## 開発

### ビルド

```bash
npm run build
```

### リント

```bash
npm run lint
```

## ライセンス

このプロジェクトはMITライセンスの下で公開されています。

## 貢献

プルリクエストを歓迎します。大きな変更の場合は、まずissueで変更内容を議論してください。

## 作者

バレーボール統計記録アプリ

---

## 関連ドキュメント

- [デプロイガイド](./DEPLOYMENT_GUIDE.md)
- [GitHubセットアップガイド](./GITHUB_SETUP.md)
- [機能改善提案](./IMPROVEMENT_PROPOSALS.md)

