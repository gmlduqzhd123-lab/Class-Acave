import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "수업서랍 · 6학년 자료 아카이브",
  description: "교과 수업부터 학급 업무까지, 찾고 모아 다시 꺼내 쓰는 나의 자료 서랍.",
  icons: {
    icon: "/archive-icon.svg",
    shortcut: "/archive-icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
