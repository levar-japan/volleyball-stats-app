# Firestoreセキュリティルールのデプロイ方法

## ローカルからデプロイ

### 1. Firebase CLIのインストール

```bash
npm install -g firebase-tools
```

### 2. Firebaseにログイン

```bash
firebase login
```

### 3. プロジェクトを選択

```bash
firebase use --add
```

プロジェクトIDを選択または入力します。

### 4. セキュリティルールをデプロイ

```bash
cd firebase
firebase deploy --only firestore:rules
```

## Firebase Consoleから設定

### 1. Firebase Consoleにアクセス

https://console.firebase.google.com/

### 2. プロジェクトを選択

### 3. Firestore Databaseを開く

左メニューから「Firestore Database」を選択

### 4. 「ルール」タブを開く

### 5. 以下のルールをコピー＆ペースト

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // teamsコレクションに対するルール
    match /teams/{teamId} {
      // チームコードを検証するために、未認証ユーザーでも読み取り（get, list）を許可する
      allow get, list: if true;

      // ただし、チームの作成、更新、削除は認証されたユーザーのみ許可する
      allow create, update, delete: if request.auth != null;
    }

    // teamsのサブコレクション（players, matches, seasonsなど）に対するルール
    match /teams/{teamId}/{document=**} {
      // 認証されたユーザー（匿名認証を含む）は読み書き可能
      allow read, write: if request.auth != null;
    }
    
    // デフォルト: その他のコレクションへのアクセスは拒否
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### 6. 「公開」をクリック

## 匿名認証の有効化

Firestoreのルールが正しく設定されていても、匿名認証が有効になっていないとエラーが発生します。

### Firebase Consoleで匿名認証を有効化

1. Firebase Console → Authentication
2. 「サインイン方法」タブを開く
3. 「匿名」を選択
4. 「有効にする」をクリック
5. 「保存」をクリック

## トラブルシューティング

### 権限エラーが続く場合

1. **匿名認証が有効か確認**
   - Firebase Console → Authentication → サインイン方法
   - 「匿名」が有効になっているか確認

2. **セキュリティルールが正しくデプロイされているか確認**
   - Firebase Console → Firestore Database → ルール
   - ルールが正しく設定されているか確認

3. **ブラウザのキャッシュをクリア**
   - 開発者ツールを開く（F12）
   - Application → Clear storage → Clear site data

4. **ログビューアーでエラーを確認**
   - 右下のログアイコンボタンをクリック
   - パスワードを入力（デフォルト: dev123）
   - エラーログを確認

