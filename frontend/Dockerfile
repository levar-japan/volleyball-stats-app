# ベースとなるNode.jsイメージを指定
FROM node:18-alpine

# コンテナ内の作業ディレクトリを設定
WORKDIR /app

# 依存関係ファイルを先にコピーし、変更がない場合はキャッシュを利用する
COPY package*.json ./

# 依存関係をインストール
RUN npm install

# プロジェクトの全ファイルをコピー
COPY . .

# 開発サーバーを起動
CMD ["npm", "run", "dev"]