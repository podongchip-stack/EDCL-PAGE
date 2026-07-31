"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FirebaseError } from "firebase/app";
import { useAuth } from "@/contexts/AuthContext";
import SocialLoginButtons from "@/components/SocialLoginButtons";

function loginErrorMessage(err: unknown): string {
  if (err instanceof FirebaseError) {
    switch (err.code) {
      case "auth/invalid-credential":
      case "auth/user-not-found":
      case "auth/wrong-password":
        return "이메일 또는 비밀번호가 올바르지 않습니다.";
      case "auth/invalid-email":
        return "이메일 형식이 올바르지 않습니다.";
      case "auth/too-many-requests":
        return "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.";
      case "auth/user-disabled":
        return "비활성화된 계정입니다. 관리자에게 문의하세요.";
      case "auth/network-request-failed":
        return "네트워크 오류가 발생했습니다. 연결 상태를 확인해주세요.";
    }
  }
  return "로그인에 실패했습니다. 잠시 후 다시 시도해주세요.";
}

export default function LoginPage() {
  const { user, loading, logIn, socialSignInPending } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 이미 로그인 상태면 홈으로 보낸다.
  // 단, 소셜 로그인 진행 중에는 보류한다(users 문서 생성 완료 전에 페이지가
  // 언마운트되면 실패 안내 메시지가 유실되기 때문).
  useEffect(() => {
    if (!loading && user && !socialSignInPending) {
      router.replace("/");
    }
  }, [user, loading, socialSignInPending, router]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await logIn(email.trim(), password);
      router.replace("/");
    } catch (err) {
      setError(loginErrorMessage(err));
      setSubmitting(false);
    }
  };

  if (loading || user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mx-auto mt-8 w-full max-w-sm">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">로그인</h1>
          <p className="mt-1 text-sm text-gray-500">
            EDCL 연구실 계정으로 로그인하세요.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700"
              >
                이메일
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700"
              >
                비밀번호
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                placeholder="비밀번호"
              />
            </div>

            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "로그인 중..." : "로그인"}
            </button>
          </form>

          <SocialLoginButtons onError={setError} />

          <p className="mt-4 text-center text-sm text-gray-500">
            아직 계정이 없나요?{" "}
            <Link
              href="/signup"
              className="font-medium text-blue-600 hover:underline"
            >
              회원가입
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
