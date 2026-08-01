"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FirebaseError } from "firebase/app";
import { SocialSignInError, useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { AuthStrings, publicStrings } from "@/lib/publicStrings";

// null 반환은 "오류 표시 없음"(사용자가 팝업을 직접 닫은 경우)을 뜻한다.
function socialErrorMessage(err: unknown, t: AuthStrings): string | null {
  if (err instanceof FirebaseError) {
    switch (err.code) {
      case "auth/popup-closed-by-user":
      case "auth/cancelled-popup-request":
        return null;
      case "auth/popup-blocked":
        return t.errPopupBlocked;
      case "auth/account-exists-with-different-credential":
        return t.errAccountExists;
      case "auth/network-request-failed":
        return t.errNetwork;
      case "auth/unauthorized-domain":
        return t.errUnauthorizedDomain;
    }
    return t.errSocialFail;
  }
  // 안내용으로 만든 오류만 원문을 보여주고, 그 외(SDK 내부 오류 등)는
  // 영어 원문이 노출되지 않도록 일반 메시지로 통일한다.
  if (err instanceof SocialSignInError) {
    return err.message;
  }
  return t.errSocialFail;
}

interface SocialLoginButtonsProps {
  onError: (message: string | null) => void;
}

export default function SocialLoginButtons({
  onError,
}: SocialLoginButtonsProps) {
  const { signInWithGoogle, signInWithGithub } = useAuth();
  const { lang } = useLanguage();
  const t = publicStrings(lang).auth;
  const router = useRouter();
  const [busy, setBusy] = useState<"google" | "github" | null>(null);

  const handleSignIn = async (provider: "google" | "github") => {
    if (busy) return;
    onError(null);
    setBusy(provider);
    try {
      if (provider === "google") {
        await signInWithGoogle();
      } else {
        await signInWithGithub();
      }
      router.replace("/");
    } catch (err) {
      onError(socialErrorMessage(err, t));
      setBusy(null);
    }
  };

  const buttonClass =
    "flex w-full items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700";

  return (
    <div className="mt-6">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {t.or}
        </span>
        <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
      </div>

      <div className="mt-4 space-y-2">
        <button
          type="button"
          onClick={() => handleSignIn("google")}
          disabled={busy !== null}
          className={buttonClass}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          {busy === "google" ? t.googleBusy : t.continueGoogle}
        </button>

        <button
          type="button"
          onClick={() => handleSignIn("github")}
          disabled={busy !== null}
          className={buttonClass}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path
              className="fill-[#181717] dark:fill-gray-100"
              d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.75 2.69 1.25 3.35.95.1-.74.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.15 1.18a10.9 10.9 0 0 1 2.87-.39c.97 0 1.95.13 2.87.39 2.19-1.49 3.15-1.18 3.15-1.18.62 1.59.23 2.76.11 3.05.73.81 1.18 1.83 1.18 3.09 0 4.41-2.7 5.38-5.26 5.67.41.35.78 1.05.78 2.12 0 1.53-.01 2.76-.01 3.14 0 .31.2.67.8.56A10.52 10.52 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z"
            />
          </svg>
          {busy === "github" ? t.githubBusy : t.continueGithub}
        </button>
      </div>
    </div>
  );
}
