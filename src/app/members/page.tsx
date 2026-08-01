"use client";

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { LabInfo, PublicProfile } from "@/types";
import { useLanguage } from "@/contexts/LanguageContext";
import { publicStrings } from "@/lib/publicStrings";

// 공개 페이지 — 로그인 없이 visible=true인 프로필만 조회한다 (보안규칙과 일치)
export default function MembersPage() {
  const { lang } = useLanguage();
  const t = publicStrings(lang).members;
  const [info, setInfo] = useState<LabInfo | null>(null);
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

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, "siteContent", "labInfo"), (snap) => {
      setInfo(snap.exists() ? (snap.data() as LabInfo) : null);
    });
    return unsubscribe;
  }, []);

  const sorted = [...profiles].sort((a, b) =>
    a.name.localeCompare(b.name, "ko")
  );
  const current = sorted.filter((p) => !p.isAlumni);
  const alumni = sorted.filter((p) => p.isAlumni);

  const advisorBio =
    (lang === "en" ? info?.advisorBioEn || info?.advisorBio : info?.advisorBio) ??
    "";
  const showAdvisor = !!(info?.professor || advisorBio);

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

      {showAdvisor && (
        <section className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-blue-600 px-2.5 py-0.5 text-xs font-medium text-white">
              {t.advisorTitle}
            </span>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {info?.professor}
            </h2>
          </div>
          {advisorBio && (
            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-600 dark:text-gray-400">
              {advisorBio}
            </p>
          )}
          {info?.contact && (
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
              {info.contact}
            </p>
          )}
        </section>
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
          <>
            {current.length > 0 && (
              <>
                {alumni.length > 0 && (
                  <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {t.currentTitle}
                  </h2>
                )}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {current.map((p) => (
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
              </>
            )}
            {alumni.length > 0 && (
              <section className="mt-8">
                <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {t.alumniTitle}
                </h2>
                <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
                  <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                    {alumni.map((p) => (
                      <li
                        key={p.uid}
                        className="flex flex-wrap items-center gap-2 px-4 py-3"
                      >
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {p.name}
                        </span>
                        {p.position && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {p.position}
                          </span>
                        )}
                        {p.interests && (
                          <span className="min-w-0 flex-1 truncate text-xs text-gray-400 dark:text-gray-500">
                            {p.interests}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
