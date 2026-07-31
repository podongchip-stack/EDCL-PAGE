"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

interface AuthGuardProps {
  children: ReactNode;
  requireAdmin?: boolean;
}

// 로그인 + 관리자 승인(approved)된 사용자만 children을 렌더링한다.
// requireAdmin이 true면 admin 역할까지 요구한다.
export default function AuthGuard({
  children,
  requireAdmin = false,
}: AuthGuardProps) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!profile || profile.status !== "approved") {
      router.replace("/pending");
      return;
    }
    if (requireAdmin && profile.role !== "admin") {
      router.replace("/");
    }
  }, [user, profile, loading, requireAdmin, router]);

  const allowed =
    !loading &&
    !!user &&
    !!profile &&
    profile.status === "approved" &&
    (!requireAdmin || profile.role === "admin");

  if (!allowed) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
      </div>
    );
  }

  return <>{children}</>;
}
