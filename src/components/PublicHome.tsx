"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { LabInfo, NewsItem, Publication } from "@/types";
import { useLanguage } from "@/contexts/LanguageContext";
import { publicStrings } from "@/lib/publicStrings";

function pubMillis(p: Publication): number {
  return p.createdAt ? p.createdAt.toMillis() : Number.MAX_SAFE_INTEGER;
}

export default function PublicHome() {
  const { lang } = useLanguage();
  const t = publicStrings(lang).home;
  const [info, setInfo] = useState<LabInfo | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [pubs, setPubs] = useState<Publication[]>([]);

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

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "publications"), (snap) => {
      setPubs(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Publication));
    });
    return unsubscribe;
  }, []);

  const [news, setNews] = useState<NewsItem[]>([]);
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "news"), (snap) => {
      setNews(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as NewsItem));
    });
    return unsubscribe;
  }, []);

  const recentPubs = [...pubs]
    .sort((a, b) => (a.year === b.year ? pubMillis(b) - pubMillis(a) : b.year - a.year))
    .slice(0, 3);
  const recentNews = [...news]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 3);

  const grants = (info?.grantsText ?? "")
    .split("\n")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
  const joinUs =
    (lang === "en" ? info?.joinUsEn || info?.joinUs : info?.joinUs) ?? "";

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
          {grants.length > 0 && (
            <div className="mt-6 border-t border-gray-100 pt-4 dark:border-gray-800">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {t.grantsTitle}
              </h3>
              <ul className="mt-2 space-y-1.5">
                {grants.map((g) => (
                  <li
                    key={g}
                    className="flex gap-2 text-sm text-gray-600 dark:text-gray-400"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                    <span className="break-words">{g}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {recentNews.length > 0 && (
        <section className="mx-auto mt-8 max-w-3xl rounded-lg border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {t.recentNews}
            </h2>
            <Link
              href="/news"
              className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              {t.viewAllNews}
            </Link>
          </div>
          <ul className="mt-4 space-y-3">
            {recentNews.map((n) => (
              <li key={n.id} className="flex gap-3">
                <span className="w-24 shrink-0 text-xs text-gray-400 dark:text-gray-500">
                  {n.date}
                </span>
                <span className="min-w-0 break-words text-sm text-gray-800 dark:text-gray-200">
                  {n.title}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {recentPubs.length > 0 && (
        <section className="mx-auto mt-8 max-w-3xl rounded-lg border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {t.recentPubs}
            </h2>
            <Link
              href="/publications"
              className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              {t.viewAllPubs}
            </Link>
          </div>
          <ul className="mt-4 space-y-3">
            {recentPubs.map((p) => (
              <li key={p.id}>
                {p.link ? (
                  <a
                    href={p.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-words text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {p.title}
                  </a>
                ) : (
                  <p className="break-words text-sm font-medium text-gray-900 dark:text-gray-100">
                    {p.title}
                  </p>
                )}
                <p className="mt-0.5 break-words text-xs text-gray-500 dark:text-gray-400">
                  {p.authors}
                  {p.venue && ` · ${p.venue}`} · {p.year}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {joinUs && (
        <section className="mx-auto mt-8 max-w-3xl rounded-lg border border-blue-200 bg-blue-50/50 p-8 dark:border-blue-900 dark:bg-blue-950/20">
          <h2 className="text-xl font-bold text-blue-800 dark:text-blue-300">
            {t.joinUsTitle}
          </h2>
          <p className="mt-3 whitespace-pre-wrap break-words text-base leading-relaxed text-gray-700 dark:text-gray-300">
            {joinUs}
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
