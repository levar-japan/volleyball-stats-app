/** @type {import('next').NextConfig} */
const nextConfig = {
  // Turbopack設定（Next.js 16対応）
  turbopack: {},
  webpack: (config, { isServer }) => {
    // isServerがtrueの場合はNode.jsのサーバー環境、falseの場合はブラウザ環境
    // 今回はブラウザ側でのホットリロードが目的なので isServer が false の時だけ設定
    if (!isServer) {
      config.watchOptions = {
        // 1000ミリ秒（1秒）ごとにファイルの変更をチェックする（ポーリング）
        poll: 1000,
        // ファイル変更後、300ミリ秒待ってから再ビルドを開始する
        aggregateTimeout: 300,
      };
    }
    return config;
  },
};

export default nextConfig;