import type { MetadataRoute } from "next";

// PWA 매니페스트 — 휴대폰/데스크톱에서 "홈 화면에 추가"로 앱처럼 설치할 수 있다
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "EDCL LAB",
    short_name: "EDCL",
    description: "EDCL 연구실 일정·작업 공유 페이지",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f4f6",
    theme_color: "#2563eb",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
