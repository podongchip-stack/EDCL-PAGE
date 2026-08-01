"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FirebaseError } from "firebase/app";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { AuthStrings, publicStrings } from "@/lib/publicStrings";
import SocialLoginButtons from "@/components/SocialLoginButtons";

function loginErrorMessage(err: unknown, t: AuthStrings): string {
  if (err instanceof FirebaseError) {
    switch (err.code) {
      case "auth/invalid-credential":
      case "auth/user-not-found":
      case "auth/wrong-password":
        return t.errInvalidCredential;
      case "auth/invalid-email":
        return t.errInvalidEmail;
      case "auth/too-many-requests":
        return t.errTooMany;
      case "auth/user-disabled":
        return t.errDisabled;
      case "auth/network-request-failed":
        return t.errNetwork;
    }
  }
  return t.errLoginFail;
}

export default function LoginPage() {
  const { user, loading, logIn, socialSignInPending } = useAuth();
  const { lang } = useLanguage();
  const t = publicStrings(lang).auth;
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
      setError(loginErrorMessage(err, t));
      setSubmitting(false);
    }
  };

  if (loading || user) {
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
            {t.loginTitle}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t.loginSubtitle}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                {t.email}
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {t.password}
                </label>
                <Link
                  href="/reset-password"
                  className="text-xs text-gray-500 hover:text-blue-600 hover:underline dark:text-gray-400 dark:hover:text-blue-400"
                >
                  {t.forgotPassword}
                </Link>
              </div>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                placeholder={t.password}
              />
            </div>

            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/50 dark:text-red-400">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? t.loggingIn : t.loginButton}
            </button>
          </form>

          <SocialLoginButtons onError={setError} />

          <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
            {t.noAccount}{" "}
            <Link
              href="/signup"
              className="font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              {t.signupLink}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
