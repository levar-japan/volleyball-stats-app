import '@mantine/core/styles.css';
import { MantineProvider } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import { AuthProvider } from "@/lib/firebase/auth";
// ↓ ステップ1で作成したファイルからFirebaseProviderを読み込みます
import { FirebaseProvider } from "@/lib/firebase/firebase-provider";
import "@/styles/globals.css";

export const metadata = {
  title: "Volleyball Stats App",
  description: "バレーボールの個人成績をリアルタイムで記録・分析するためのWebアプリケーションです。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <MantineProvider forceColorScheme="light">
          <Notifications />
          <ModalsProvider>
            <AuthProvider>
              {/* ↓ アプリ全体をFirebaseProviderで包みます */}
              <FirebaseProvider>
                {children}
              </FirebaseProvider>
            </AuthProvider>
          </ModalsProvider>
        </MantineProvider>
      </body>
    </html>
  );
}