"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import SearchModal from "@/components/SearchModal";

const MEMBER_LINKS = [
  { href: "/", label: "대시보드" },
  { href: "/calendar", label: "일정표" },
  { href: "/projects", label: "프로젝트" },
  { href: "/resources", label: "자료실" },
  { href: "/news", label: "소식" },
];

export default function Navbar() {
  const { user, profile, logOut } = useAuth();
  const { lang, setLang } = useLanguage();
  const pathname = usePathname();
  const router = useRouter();
  const [showSearch, setShowSearch] = useState(false);

  const approved = profile?.status === "approved";

  // Ctrl+K / Cmd+K로 통합 검색 열기 (승인된 구성원만)
  useEffect(() => {
    if (!approved) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowSearch(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [approved]);

  const handleLogout = async () => {
    await logOut();
    router.replace("/login");
  };

  const linkClass = (href: string) =>
    `whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
      pathname === href
        ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
    }`;

  // 내비 탭은 승인된 구성원에게만 보인다 (로그인 전 방문자는 로고·언어 전환·로그인 버튼만)
  const navLinks = (
    <>
      {MEMBER_LINKS.map((link) => (
        <Link key={link.href} href={link.href} className={linkClass(link.href)}>
          {link.label}
        </Link>
      ))}
      {profile?.role === "admin" && (
        <Link href="/admin" className={linkClass("/admin")}>
          관리자
        </Link>
      )}
      <Link href="/settings" className={linkClass("/settings")}>
        설정
      </Link>
    </>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="mx-auto max-w-5xl px-4">
        <div className="flex h-14 items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-6">
            <Link
              href="/"
              className="flex shrink-0 items-center gap-2 text-lg font-bold text-blue-700 dark:text-blue-400"
            >
              {/* SVG 로고는 최적화가 필요 없어 unoptimized로 그대로 서빙한다 */}
              <Image
                src="/logo.svg"
                alt=""
                width={28}
                height={28}
                unoptimized
                priority
              />
              EDCL LAB
            </Link>
            {approved && (
              <nav className="hidden items-center gap-1 lg:flex">{navLinks}</nav>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!approved && (
              <button
                type="button"
                onClick={() => setLang(lang === "ko" ? "en" : "ko")}
                aria-label={lang === "ko" ? "Switch to English" : "한국어로 전환"}
                className="rounded-md px-2 py-1.5 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              >
                {lang === "ko" ? "EN" : "한"}
              </button>
            )}
            {approved && (
              <button
                type="button"
                onClick={() => setShowSearch(true)}
                aria-label="검색 (Ctrl+K)"
                title="검색 (Ctrl+K)"
                className="rounded-md p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </button>
            )}
            {user ? (
              <div className="flex items-center gap-3">
                <span className="hidden text-sm text-gray-600 sm:inline dark:text-gray-400">
                  {profile?.name ?? user.email}
                </span>
                <button
                  onClick={handleLogout}
                  className="whitespace-nowrap rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  로그아웃
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="whitespace-nowrap rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                {lang === "en" ? "Login" : "로그인"}
              </Link>
            )}
          </div>
        </div>
        {/* 좁은 화면에서는 탭을 둘째 줄에 배치해 잘림 없이 접근 가능하게 한다 */}
        {approved && (
          <nav className="-mx-1 flex items-center gap-1 overflow-x-auto px-1 pb-2 lg:hidden">
            {navLinks}
          </nav>
        )}
      </div>
      {showSearch && <SearchModal onClose={() => setShowSearch(false)} />}
    </header>
  );
}
