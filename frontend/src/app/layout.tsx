// ↓ 1. この行を新しく追加します
import '@mantine/core/styles.css';

import { MantineProvider } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import { AuthProvider } from "@/lib/firebase/auth";
import "../styles/globals.css";

export const metadata = {
  title: "Volleyball Stats App",
  description: "バレーボールの個人成績をリアルタイムで記録・分析するためのWebアプリケーションです。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        {/* ↓ 2. 不要な設定を削除し、シンプルにします */}
        <MantineProvider forceColorScheme="light">
          <Notifications />
          <ModalsProvider>
            <AuthProvider>
              {children}
            </AuthProvider>
          </ModalsProvider>
        </MantineProvider>
      </body>
    </html>
  );
}