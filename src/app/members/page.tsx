"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { PublicProfile } from "@/types";
import { useLanguage } from "@/contexts/LanguageContext";
import { publicStrings } from "@/lib/publicStrings";

// 공개 페이지 — 로그인 없이 visible=true인 프로필만 조회한다 (보안규칙과 일치)
export default function MembersPage() {
  const { lang } = useLanguage();
  const t = publicStrings(lang).members;
  const [profiles, setProfiles] = useState<PublicProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "publicProfiles"), where("visible", "==", true)),
      (snap) => {
        setProfiles(
          snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as PublicProfile)
        );
        setLoadError(null);
        setLoading(false);
      },
      () => {
        setLoadError("error");
        setLoading(false);
      }
    );
    return unsubscribe;
  }, []);

  const sorted = [...profiles].sort((a, b) =>
    a.name.localeCompare(b.name, "ko")
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        {t.title}
      </h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {t.subtitle}
      </p>

      {loadError && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/50 dark:text-red-400">
          {t.loadError}
        </p>
      )}

      <div className="mt-6">
        {loading ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">
            {t.loading}
          </p>
        ) : sorted.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-10 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t.empty}
            </p>
            <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
              {t.emptyHint}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sorted.map((p) => (
              <div
                key={p.uid}
                className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900"
              >
                <div className="flex items-center gap-2">
                  <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                    {p.name}
                  </p>
                  {p.position && (
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                      {p.position}
                    </span>
                  )}
                </div>
                {p.interests && (
                  <p className="mt-2 break-words text-sm text-gray-600 dark:text-gray-400">
                    {p.interests}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
