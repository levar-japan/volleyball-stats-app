# GitHubセットアップガイド

このガイドでは、プロジェクトをGitHubにアップロードする手順を説明します。

## 📋 前提条件

- Gitがインストールされていること
- GitHubアカウントを持っていること
- GitHub CLIまたはブラウザでGitHubにアクセスできること

## 🚀 手順

### 1. Gitリポジトリの初期化（まだの場合）

プロジェクトルート（`volleyball-stats-app`）で以下を実行：

```bash
# Gitリポジトリを初期化
git init

# 現在の状態を確認
git status
```

### 2. すべてのファイルをステージング

```bash
# すべてのファイルを追加（.gitignoreで除外されるファイルは除く）
git add .

# 追加されたファイルを確認
git status
```

### 3. 初回コミット

```bash
git commit -m "Initial commit: Volleyball stats app with analytics and season management"
```

### 4. GitHubリポジトリの作成

#### 方法A: GitHub CLIを使用（推奨）

```bash
# GitHub CLIがインストールされている場合
gh repo create volleyball-stats-app --public --source=. --remote=origin --push
```

#### 方法B: ブラウザで作成

1. [GitHub](https://github.com)にログイン
2. 右上の「+」→「New repository」をクリック
3. 以下を設定：
   - Repository name: `volleyball-stats-app`（任意の名前）
   - Description: `バレーボール統計記録アプリ`
   - Public/Private: お好みで選択
   - **「Initialize this repository with」のチェックは外す**（既にローカルにファイルがあるため）
4. 「Create repository」をクリック

### 5. リモートリポジトリを追加

```bash
# ブラウザで作成した場合、表示されるURLを使用
git remote add origin https://github.com/あなたのユーザー名/volleyball-stats-app.git

# またはSSHを使用する場合
# git remote add origin git@github.com:あなたのユーザー名/volleyball-stats-app.git

# リモートを確認
git remote -v
```

### 6. ブランチ名をmainに設定（必要に応じて）

```bash
git branch -M main
```

### 7. プッシュ

```bash
# 初回プッシュ
git push -u origin main
```

## 🔐 環境変数の設定

**重要**: `.env`ファイルは`.gitignore`に含まれているため、GitHubにプッシュされません。

### ローカル環境

`.env`ファイルをルートディレクトリに作成：

```bash
# .env.exampleをコピーして作成
cp .env.example .env

# エディタで.envを開き、Firebaseの設定値を入力
```

### GitHub Actions / Vercelでの使用

環境変数は以下の場所で設定します：

- **GitHub Secrets**: Settings > Secrets and variables > Actions
- **Vercel**: Project Settings > Environment Variables

## 📝 コミットメッセージのベストプラクティス

今後のコミット時は、わかりやすいメッセージを使用：

```bash
# 機能追加
git commit -m "feat: シーズン管理機能を追加"

# バグ修正
git commit -m "fix: 統計分析ページのデータ取得エラーを修正"

# 改善
git commit -m "improve: ダッシュボードのUIを改善"

# ドキュメント
git commit -m "docs: デプロイガイドを追加"
```

## 🔄 今後の作業フロー

### 変更をコミットしてプッシュ

```bash
# 変更を確認
git status

# 変更をステージング
git add .

# コミット
git commit -m "コミットメッセージ"

# プッシュ
git push
```

### ブランチを使用する場合

```bash
# 新しいブランチを作成
git checkout -b feature/新機能名

# 変更をコミット
git add .
git commit -m "feat: 新機能を追加"

# ブランチをプッシュ
git push -u origin feature/新機能名

# GitHubでプルリクエストを作成
```

## 📦 除外されるファイル

`.gitignore`により、以下はGitHubにアップロードされません：

- `node_modules/` - 依存関係（`npm install`で再インストール）
- `.env*` - 環境変数ファイル（機密情報を含む）
- `.next/` - ビルド出力
- `.vercel/` - Vercel設定

## 🚨 トラブルシューティング

### 問題1: 大きなファイルが含まれている

```bash
# node_modulesが含まれていないか確認
git status | grep node_modules

# .gitignoreが正しく機能しているか確認
git check-ignore -v node_modules
```

### 問題2: .envファイルを誤ってコミットしてしまった

```bash
# .envをGitから削除（ファイル自体は残る）
git rm --cached .env

# .gitignoreに.envが含まれているか確認
# コミット
git commit -m "remove: .envファイルをGitから除外"
```

### 問題3: 認証エラー

```bash
# HTTPSを使用している場合、Git認証情報を設定
git config --global credential.helper store

# または、Personal Access Tokenを使用
# GitHub Settings > Developer settings > Personal access tokens
```

## ✅ チェックリスト

GitHubにプッシュする前に確認：

- [ ] `.env`ファイルが`.gitignore`に含まれている
- [ ] `node_modules`が除外されている
- [ ] 機密情報（APIキーなど）がコードに直接書かれていない
- [ ] `.env.example`に環境変数のテンプレートがある
- [ ] `README.md`にセットアップ手順がある（任意）

## 📚 次のステップ

GitHubにプッシュ後：

1. **Vercelと連携**
   - GitHubリポジトリをVercelに接続
   - 環境変数を設定
   - 自動デプロイを有効化

2. **GitHub Actionsの設定**（任意）
   - CI/CDパイプラインの構築
   - 自動テストの実行

3. **README.mdの更新**
   - プロジェクトの説明
   - セットアップ手順
   - 使用方法

## 🔗 参考リンク

- [Git公式ドキュメント](https://git-scm.com/doc)
- [GitHub Docs](https://docs.github.com/)
- [GitHub CLI](https://cli.github.com/)

---

これで、プロジェクトをGitHubに安全にアップロードできます！

