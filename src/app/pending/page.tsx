"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

// 승인 전(pending) 사용자용 페이지이므로 AuthGuard를 쓰지 않고 직접 분기한다.
export default function PendingPage() {
  const { user, profile, loading, logOut } = useAuth();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (profile?.status === "approved") {
      router.replace("/");
    }
  }, [user, profile, loading, router]);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    await logOut();
    router.replace("/login");
  };

  if (loading || !user || profile?.status === "approved") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600 dark:border-blue-950 dark:border-t-blue-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mx-auto mt-8 w-full max-w-sm">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            승인 대기 중
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
            가입 신청이 접수되었습니다. 관리자 승인 후 이용할 수 있습니다.
          </p>
          <div className="mt-4 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-300">
            가입 이메일:{" "}
            <span className="font-medium">
              {profile?.email ?? user.email ?? "-"}
            </span>
          </div>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="mt-6 w-full rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            {loggingOut ? "로그아웃 중..." : "로그아웃"}
          </button>
        </div>
      </div>
    </div>
  );
}
