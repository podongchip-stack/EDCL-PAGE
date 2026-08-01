"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { FirebaseError } from "firebase/app";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSent(true);
    } catch (err) {
      if (err instanceof FirebaseError) {
        if (err.code === "auth/invalid-email") {
          setError("이메일 형식이 올바르지 않습니다.");
        } else if (err.code === "auth/user-not-found") {
          // 가입 여부가 노출되지 않도록 성공과 동일하게 안내한다
          setSent(true);
        } else if (err.code === "auth/too-many-requests") {
          setError("요청이 너무 많습니다. 잠시 후 다시 시도해주세요.");
        } else {
          setError("메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요.");
        }
      } else {
        setError("메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mx-auto mt-8 w-full max-w-sm">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            비밀번호 재설정
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            가입한 이메일로 재설정 링크를 보내드립니다.
          </p>

          {sent ? (
            <div className="mt-6">
              <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950/50 dark:text-green-400">
                입력하신 주소로 재설정 메일을 발송했습니다. 받은편지함(스팸함
                포함)을 확인해주세요.
              </p>
              <Link
                href="/login"
                className="mt-4 block w-full rounded-md bg-blue-600 px-4 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                로그인으로 돌아가기
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
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
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                  placeholder="you@example.com"
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
                {submitting ? "발송 중..." : "재설정 메일 보내기"}
              </button>
            </form>
          )}

          {!sent && (
            <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
              비밀번호가 기억나셨나요?{" "}
              <Link
                href="/login"
                className="font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                로그인
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
