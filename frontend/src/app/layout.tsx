import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { FirebaseProvider } from "./FirebaseProvider";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { GlobalProviders } from "@/components/GlobalProviders";
import { LogViewerButton } from "@/components/LogViewerButton";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Volleyball Stats App",
  description: "個人成績記録アプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={inter.className}>
        <FirebaseProvider>
          <GlobalProviders>
            <OfflineIndicator />
            {children}
            <LogViewerButton />
          </GlobalProviders>
        </FirebaseProvider>
      </body>
    </html>
  );
}