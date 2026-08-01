"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

const NAV_LINKS = [
  { href: "/", label: "대시보드" },
  { href: "/calendar", label: "일정표" },
  { href: "/projects", label: "프로젝트" },
];

export default function Navbar() {
  const { user, profile, logOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const approved = profile?.status === "approved";

  const handleLogout = async () => {
    await logOut();
    router.replace("/login");
  };

  const linkClass = (href: string) =>
    `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
      pathname === href
        ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <div className="flex min-w-0 items-center gap-6">
          <Link
            href="/"
            className="shrink-0 text-lg font-bold text-blue-700 dark:text-blue-400"
          >
            EDCL LAB
          </Link>
          {approved && (
            <nav className="flex items-center gap-1 overflow-x-auto">
              {NAV_LINKS.map((link) => (
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
            </nav>
          )}
        </div>
        <div className="shrink-0">
          {user ? (
            <div className="flex items-center gap-3">
              <span className="hidden text-sm text-gray-600 sm:inline dark:text-gray-400">
                {profile?.name ?? user.email}
              </span>
              <button
                onClick={handleLogout}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                로그아웃
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              로그인
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
