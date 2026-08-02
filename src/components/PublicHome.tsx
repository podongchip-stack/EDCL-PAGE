"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { LabInfo, NewsItem, Publication } from "@/types";
import { useLanguage } from "@/contexts/LanguageContext";
import { publicStrings } from "@/lib/publicStrings";
import Battery3D from "@/components/Battery3D";

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
    <div>
      {/* ===== 표지 (풀스크린 히어로) — 테마와 무관하게 어두운 커버로 고정 ===== */}
      <section className="relative overflow-hidden bg-slate-950 text-white">
        {/* 격자 + 발광 배경 */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.07)_1px,transparent_1px)] bg-[size:44px_44px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 right-[-10%] h-[560px] w-[560px] rounded-full bg-cyan-500/15 blur-[120px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-[-20%] left-[-10%] h-[480px] w-[480px] rounded-full bg-blue-600/15 blur-[120px]"
        />

        <div className="relative mx-auto flex min-h-[calc(100dvh-3.5rem)] max-w-6xl flex-col items-center justify-center gap-14 px-4 pb-24 pt-14 lg:flex-row lg:gap-6">
          <div className="w-full max-w-xl text-center lg:flex-1 lg:text-left">
            <p className="font-mono text-[11px] uppercase tracking-[0.4em] text-cyan-300/90 sm:text-xs">
              Battery Management System
            </p>
            <h1 className="mt-5 text-5xl font-bold tracking-tight sm:text-7xl">
              EDCL{" "}
              <span className="bg-gradient-to-r from-cyan-300 to-emerald-300 bg-clip-text text-transparent">
                LAB
              </span>
            </h1>
            {!loaded ? (
              <div className="mx-auto mt-6 max-w-xl space-y-2 lg:mx-0">
                <div className="h-4 animate-pulse rounded bg-white/10" />
                <div className="h-4 w-2/3 animate-pulse rounded bg-white/10 lg:mx-0" />
              </div>
            ) : (
              <p className="mx-auto mt-6 max-w-xl whitespace-pre-wrap break-words text-base leading-relaxed text-slate-300 sm:text-lg lg:mx-0">
                {intro}
              </p>
            )}
            {topics.length > 0 && (
              <div className="mt-7 flex flex-wrap justify-center gap-2 lg:justify-start">
                {topics.map((topic) => (
                  <span
                    key={topic}
                    className="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-200 sm:text-sm"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            )}
            {(info?.professor || info?.contact) && (
              <p className="mt-8 text-sm text-slate-400">
                {info?.professor && `${t.professor} ${info.professor}`}
                {info?.professor && info?.contact && (
                  <span className="mx-2 text-slate-600">|</span>
                )}
                {info?.contact && `${t.contact} ${info.contact}`}
              </p>
            )}
          </div>
          <div className="w-full lg:flex-1">
            <Battery3D />
          </div>
        </div>

        {/* 스크롤 힌트 */}
        <a
          href="#about"
          className="absolute bottom-5 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 text-slate-400 transition-colors hover:text-cyan-300"
        >
          <span className="text-[11px] tracking-widest">{t.scrollHint}</span>
          <svg
            className="h-4 w-4 animate-bounce"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 8l5 5 5-5" />
          </svg>
        </a>
      </section>

      {/* ===== 본문 (스크롤 시 노출) ===== */}
      <div className="mx-auto max-w-5xl px-4 py-16">
        {loaded && (
          <section id="about" className="scroll-mt-20">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {t.researchTitle}
            </h2>
            <p className="mt-5 max-w-3xl whitespace-pre-wrap break-words text-base leading-relaxed text-gray-700 dark:text-gray-300">
              {research}
            </p>
            {grants.length > 0 && (
              <div className="mt-8 border-t border-gray-200 pt-6 dark:border-gray-800">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {t.grantsTitle}
                </h3>
                <ul className="mt-3 space-y-1.5">
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

        {(recentNews.length > 0 || recentPubs.length > 0) && (
          <section className="mt-16 grid gap-12 md:grid-cols-2">
            {recentNews.length > 0 && (
              <div>
                <div className="flex items-center justify-between border-b border-gray-200 pb-3 dark:border-gray-800">
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
                      <span className="w-24 shrink-0 text-xs leading-5 text-gray-400 dark:text-gray-500">
                        {n.date}
                      </span>
                      <span className="min-w-0 break-words text-sm text-gray-800 dark:text-gray-200">
                        {n.title}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {recentPubs.length > 0 && (
              <div>
                <div className="flex items-center justify-between border-b border-gray-200 pb-3 dark:border-gray-800">
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
              </div>
            )}
          </section>
        )}

        {joinUs && (
          <section className="mt-16 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 p-8 text-white sm:p-10 dark:from-blue-700 dark:to-cyan-600">
            <h2 className="text-2xl font-bold">{t.joinUsTitle}</h2>
            <p className="mt-3 whitespace-pre-wrap break-words text-base leading-relaxed text-blue-50">
              {joinUs}
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
