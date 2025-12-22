# Firebase設定ガイド

## 1. Firebaseプロジェクトの作成

1. [Firebase Console](https://console.firebase.google.com/)にアクセス
2. 「プロジェクトを追加」をクリック
3. プロジェクト名を入力して作成

## 2. Webアプリの追加

1. Firebase Consoleでプロジェクトを選択
2. プロジェクト設定（⚙️）をクリック
3. 「マイアプリ」セクションで「</>」アイコン（Web）をクリック
4. アプリのニックネームを入力（任意）
5. 「アプリを登録」をクリック

## 3. 設定値の取得

登録後、以下のような設定値が表示されます：

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

## 4. 環境変数の設定

`frontend/.env.local`ファイルを開き、以下の値を実際の設定値に置き換えてください：

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...（実際のAPIキー）
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef
```

## 5. Firebase Authenticationの設定

1. Firebase Consoleで「Authentication」を開く
2. 「始める」をクリック
3. 「匿名」を有効にする

## 6. Firestore Databaseの作成

1. Firebase Consoleで「Firestore Database」を開く
2. 「データベースを作成」をクリック
3. 「テストモードで開始」を選択（開発中）
4. ロケーションを選択（asia-northeast1など）

## 7. 開発サーバーの再起動

環境変数を変更した後は、開発サーバーを再起動してください：

```powershell
# 開発サーバーを停止（Ctrl+C）
# その後、再起動
cd frontend
npm run dev
```

