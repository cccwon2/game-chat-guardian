import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Game Chat Guardian",
  description: "게임 채팅 보호 앱",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

