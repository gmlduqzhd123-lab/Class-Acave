import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "수업서랍 · 6학년 자료 아카이브",
  description: "교과 수업부터 학급 업무까지, 찾고 모아 다시 꺼내 쓰는 나의 자료 서랍.",
  icons: {
    icon: "/archive-icon.svg",
    shortcut: "/archive-icon.svg",
    apple: "/icons/apple-touch-icon.png",
  },
  metadataBase: new URL("https://class-acave.vercel.app"),
  appleWebApp: { capable: true, title: "수업서랍" },
  openGraph: {
    type: "website", siteName: "수업서랍", locale: "ko_KR", url: "https://class-acave.vercel.app/",
    title: "수업서랍 · 6학년 자료 아카이브",
    description: "교과 수업부터 학급 업무까지, 찾고 모아 다시 꺼내 쓰는 나의 자료 서랍.",
    images: [{ url: "https://class-acave.vercel.app/og-image.jpg", width: 1200, height: 630, alt: "수업서랍" }],
  },
  twitter: { card: "summary_large_image", images: ["https://class-acave.vercel.app/og-image.jpg"] },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" data-qr-url="https://class-acave.vercel.app/" data-qr-src="/qr.svg" data-qr-name="수업서랍">
      <body className="antialiased">
        {/* 📲 앱 설치 · 📱 QR (엽쌤의 다른 앱과 같은 도우미) */}
        <script src="/ys-install.js" defer />
        <script src="/ys-qr.js" defer />
        {children}
      </body>
    </html>
  );
}
