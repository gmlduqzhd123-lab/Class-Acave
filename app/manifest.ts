import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "수업서랍 · 6학년 자료 아카이브",
    short_name: "수업서랍",
    description: "교과 수업부터 학급 업무까지, 찾고 모아 다시 꺼내 쓰는 나의 자료 서랍.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fdfefa",
    theme_color: "#1f6b51",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
