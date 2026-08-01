"use client";

import AuthGuard from "@/components/AuthGuard";
import { useAuth } from "@/contexts/AuthContext";
import { ThemePreference, useTheme } from "@/contexts/ThemeContext";

const THEME_OPTIONS: {
  value: ThemePreference;
  label: string;
  description: string;
}[] = [
  {
    value: "system",
    label: "시스템 설정",
    description: "OS의 라이트/다크 설정을 자동으로 따릅니다.",
  },
  {
    value: "light",
    label: "라이트",
    description: "항상 밝은 화면으로 표시합니다.",
  },
  {
    value: "dark",
    label: "다크",
    description: "항상 어두운 화면으로 표시합니다.",
  },
];

function SettingsContent() {
  const { profile } = useAuth();
  const { preference, setPreference } = useTheme();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        설정
      </h1>

      <section className="mt-6 rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-800">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">
            화면 테마
          </h2>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            이 브라우저에만 적용되는 설정입니다.
          </p>
        </div>
        <div className="space-y-2 p-5">
          {THEME_OPTIONS.map((opt) => {
            const selected = preference === opt.value;
            return (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
                  selected
                    ? "border-blue-600 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/40"
                    : "border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800/60"
                }`}
              >
                <input
                  type="radio"
                  name="theme"
                  value={opt.value}
                  checked={selected}
                  onChange={() => setPreference(opt.value)}
                  className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="min-w-0">
                  <span
                    className={`block text-sm font-medium ${
                      selected
                        ? "text-blue-700 dark:text-blue-300"
                        : "text-gray-900 dark:text-gray-100"
                    }`}
                  >
                    {opt.label}
                  </span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400">
                    {opt.description}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-800">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">
            내 계정
          </h2>
        </div>
        <dl className="space-y-3 p-5 text-sm">
          <div className="flex gap-4">
            <dt className="w-16 shrink-0 text-gray-500 dark:text-gray-400">
              이름
            </dt>
            <dd className="font-medium text-gray-900 dark:text-gray-100">
              {profile?.name ?? "-"}
            </dd>
          </div>
          <div className="flex gap-4">
            <dt className="w-16 shrink-0 text-gray-500 dark:text-gray-400">
              이메일
            </dt>
            <dd className="text-gray-700 dark:text-gray-300">
              {profile?.email ?? "-"}
            </dd>
          </div>
          <div className="flex gap-4">
            <dt className="w-16 shrink-0 text-gray-500 dark:text-gray-400">
              역할
            </dt>
            <dd className="text-gray-700 dark:text-gray-300">
              {profile?.role === "admin" ? "관리자" : "구성원"}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <AuthGuard>
      <SettingsContent />
    </AuthGuard>
  );
}
