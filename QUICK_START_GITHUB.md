# GitHubへのアップロード - クイックスタート

## 🚀 簡単3ステップ

### 1. Gitリポジトリを初期化

```bash
# プロジェクトルートで実行
git init
```

### 2. ファイルを追加してコミット

```bash
# すべてのファイルを追加
git add .

# 初回コミット
git commit -m "Initial commit: Volleyball stats app"
```

### 3. GitHubにプッシュ

#### 方法A: GitHub CLI（簡単）

```bash
# GitHub CLIがインストールされている場合
gh repo create volleyball-stats-app --public --source=. --remote=origin --push
```

#### 方法B: ブラウザで作成

1. [GitHub.com](https://github.com)で「New repository」をクリック
2. リポジトリ名を入力（例: `volleyball-stats-app`）
3. 「Initialize this repository with」のチェックは**外す**
4. 「Create repository」をクリック
5. 表示されるコマンドを実行：

```bash
git remote add origin https://github.com/あなたのユーザー名/volleyball-stats-app.git
git branch -M main
git push -u origin main
```

## ⚠️ 重要: 環境変数

`.env`ファイルは自動的に除外されますが、念のため確認：

```bash
# .envが含まれていないか確認
git status | findstr .env
```

もし`.env`が表示されたら、`.gitignore`に`.env`が含まれているか確認してください。

## ✅ 完了！

これでGitHubにアップロードされました！

詳細は [GITHUB_SETUP.md](./GITHUB_SETUP.md) を参照してください。

