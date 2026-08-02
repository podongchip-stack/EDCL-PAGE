import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "EDCL LAB",
  description: "EDCL 연구실 일정·작업 공유 페이지",
};

// 하이드레이션 전에 테마를 적용해 화면이 번쩍이는 것을 막는다.
// 로그인 전에는 어두운 표지 디자인에 맞춰 다크로 고정하므로, Firebase가
// localStorage에 남긴 세션(firebase:authUser:*) 유무로 로그인 여부를 미리 판단한다.
const themeInitScript = `(function(){try{var s=false;for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k&&k.indexOf("firebase:authUser:")===0){s=true;break;}}var d=true;if(s){var t=localStorage.getItem("edcl-theme");d=t==="dark"||((t===null||t==="system")&&window.matchMedia("(prefers-color-scheme: dark)").matches);}if(d)document.documentElement.classList.add("dark");}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        {/* ThemeProvider가 로그인 여부에 따라 테마를 고정하므로 AuthProvider가 바깥에 온다 */}
        <AuthProvider>
          <ThemeProvider>
            <LanguageProvider>
              <Navbar />
              <main className="flex-1">{children}</main>
            </LanguageProvider>
          </ThemeProvider>
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  );
}
