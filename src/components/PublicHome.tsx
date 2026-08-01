"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { LabInfo } from "@/types";
import { useLanguage } from "@/contexts/LanguageContext";
import { publicStrings } from "@/lib/publicStrings";

export default function PublicHome() {
  const { lang } = useLanguage();
  const t = publicStrings(lang).home;
  const [info, setInfo] = useState<LabInfo | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, "siteContent", "labInfo"),
      (snap) => {
        setInfo(snap.exists() ? (snap.data() as LabInfo) : null);
        setLoaded(true);
      },
      () => setLoaded(true)
    );
    return unsubscribe;
  }, []);

  // EN 모드에서 영문 필드가 있으면 사용하고, 없으면 국문 → 기본 문구 순으로 폴백
  const intro =
    (lang === "en" ? info?.introEn || info?.intro : info?.intro) ||
    t.introFallback;
  const research =
    (lang === "en" ? info?.researchEn || info?.research : info?.research) ||
    t.researchFallback;
  const topicsRaw =
    (lang === "en" ? info?.topicsEn || info?.topics : info?.topics) ?? "";
  const topics = topicsRaw
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <section className="text-center">
        <h1 className="text-4xl font-bold text-blue-700 dark:text-blue-400">
          EDCL LAB
        </h1>
        {!loaded ? (
          <div className="mx-auto mt-6 max-w-2xl space-y-2">
            <div className="h-4 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
            <div className="mx-auto h-4 w-2/3 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
          </div>
        ) : (
          <p className="mx-auto mt-6 max-w-2xl whitespace-pre-wrap break-words text-lg leading-relaxed text-gray-700 dark:text-gray-300">
            {intro}
          </p>
        )}
        {info?.professor && (
          <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
            {t.professor}: {info.professor}
          </p>
        )}
        {info?.contact && (
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {t.contact}: {info.contact}
          </p>
        )}
      </section>

      {loaded && (
        <section className="mx-auto mt-12 max-w-3xl rounded-lg border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {t.researchTitle}
          </h2>
          {topics.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {topics.map((topic) => (
                <span
                  key={topic}
                  className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                >
                  {topic}
                </span>
              ))}
            </div>
          )}
          <p className="mt-4 whitespace-pre-wrap break-words text-base leading-relaxed text-gray-700 dark:text-gray-300">
            {research}
          </p>
        </section>
      )}

      <section className="mx-auto mt-8 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          href="/publications"
          className="rounded-lg border border-gray-200 bg-white p-6 text-center shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50/50 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-blue-800 dark:hover:bg-blue-950/30"
        >
          <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {t.pubsTitle}
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t.pubsDesc}
          </p>
        </Link>
        <Link
          href="/login"
          className="rounded-lg border border-blue-600 bg-blue-600 p-6 text-center shadow-sm transition-colors hover:bg-blue-700"
        >
          <p className="text-base font-semibold text-white">{t.loginTitle}</p>
          <p className="mt-1 text-sm text-blue-100">{t.loginDesc}</p>
        </Link>
      </section>
    </div>
  );
}
