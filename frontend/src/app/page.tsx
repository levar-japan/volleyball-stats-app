import { MantineProvider } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import { AppProps } from "next/app";
import Head from "next/head";
import { useEffect, useState } from "react"; // useStateとuseEffectをインポート
import { AuthProvider } from "@/lib/firebase/auth";
import "../styles/globals.css";

// オフライン通知バナーのスタイルを定義
const offlineBannerStyle: React.CSSProperties = {
  position: "fixed",
  bottom: 0,
  left: 0,
  width: "100%",
  backgroundColor: "#343a40",
  color: "white",
  textAlign: "center",
  padding: "10px 0",
  fontSize: "14px",
  zIndex: 9999,
  boxShadow: "0 -2px 5px rgba(0,0,0,0.2)",
};

export default function App(props: AppProps) {
  const { Component, pageProps } = props;

  // オンライン状態を管理するstateを追加
  const [isOnline, setIsOnline] = useState(true);

  // 通信状態を監視するuseEffectを追加
  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <>
      <Head>
        <title>Volleyball Stats App</title>
        <meta name="viewport" content="minimum-scale=1, initial-scale=1, width=device-width" />
        <meta name="description" content="バレーボールの個人成績をリアルタイムで記録・分析するためのWebアプリケーションです。" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <MantineProvider withGlobalStyles withNormalizeCSS theme={{ colorScheme: "light" }}>
        <Notifications />
        <ModalsProvider>
          <AuthProvider>
            <Component {...pageProps} />

            {/* オフライン時にバナーを表示するコードを追加 */}
            {!isOnline && (
              <div style={offlineBannerStyle}>
                オフラインです。記録は保存され、通信回復後に自動で同期されます。
              </div>
            )}
          </AuthProvider>
        </ModalsProvider>
      </MantineProvider>
    </>
  );
}