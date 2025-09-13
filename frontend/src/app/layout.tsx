import '@mantine/core/styles.css';
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
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
          {children}
        </MantineProvider>
      </body>
    </html>
  );
}