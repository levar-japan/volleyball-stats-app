# ベースとなるNode.jsイメージを指定
FROM node:18-alpine

# ★★★★★ ここにJavaのインストールコマンドを追加 ★★★★★
# パッケージリストを更新し、Java(JRE)をインストールする
RUN apk update && apk add openjdk17-jre

# firebase-toolsをグローバルにインストール
RUN npm install -g firebase-tools

# コンテナ内の作業ディレクトリを設定
WORKDIR /usr/src/app

# 設定ファイルをコピー
COPY . .

# コンテナ起動時にエミュレータを開始
CMD ["firebase", "emulators:start", "--project", "volleyball-stats-app-dev", "--only", "auth,firestore"]