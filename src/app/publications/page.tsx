"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { db } from "@/lib/firebase";
import { publicStrings } from "@/lib/publicStrings";
import { Publication } from "@/types";

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500";

// 공개 페이지 — 목록은 누구나 볼 수 있고, 등록/삭제는 승인된 구성원만 가능
export default function PublicationsPage() {
  const { user, profile } = useAuth();
  const { lang } = useLanguage();
  const t = publicStrings(lang).publications;
  const [pubs, setPubs] = useState<Publication[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [authors, setAuthors] = useState("");
  const [venue, setVenue] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [link, setLink] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const canManage = !!user && profile?.status === "approved";

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "publications"),
      (snap) => {
        setPubs(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Publication)
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

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || submitting) return;
    const trimmedTitle = title.trim();
    const trimmedAuthors = authors.trim();
    const yearNum = Number(year);
    if (!trimmedTitle || !trimmedAuthors) {
      setFormError("제목과 저자를 입력하세요.");
      return;
    }
    if (!Number.isInteger(yearNum) || yearNum < 1990 || yearNum > 2100) {
      setFormError("연도를 올바르게 입력하세요.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await addDoc(collection(db, "publications"), {
        title: trimmedTitle,
        authors: trimmedAuthors,
        venue: venue.trim(),
        year: yearNum,
        link: link.trim(),
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });
      setTitle("");
      setAuthors("");
      setVenue("");
      setLink("");
      setShowForm(false);
    } catch {
      setFormError("등록에 실패했습니다. 잠시 후 다시 시도하세요.");
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (pub: Publication) => {
    setBusyId(pub.id);
    try {
      await deleteDoc(doc(db, "publications", pub.id));
    } finally {
      setBusyId(null);
      setConfirmDeleteId(null);
    }
  };

  // 연도 내림차순 → 제목순으로 연도별 그룹핑
  const years = [...new Set(pubs.map((p) => p.year))].sort((a, b) => b - a);
  const byYear = (y: number) =>
    pubs
      .filter((p) => p.year === y)
      .sort((a, b) => a.title.localeCompare(b.title));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {t.title}
        </h1>
        {canManage && (
          <button
            type="button"
            onClick={() => {
              setShowForm((v) => !v);
              setFormError(null);
            }}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            {showForm ? "닫기" : "논문 추가"}
          </button>
        )}
      </div>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {t.subtitle}
      </p>

      {loadError && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/50 dark:text-red-400">
          {t.loadError}
        </p>
      )}

      {showForm && canManage && (
        <form
          onSubmit={handleCreate}
          className="mt-4 space-y-3 rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900"
        >
          <div>
            <label
              htmlFor="pub-title"
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              제목 <span className="text-red-500">*</span>
            </label>
            <input
              id="pub-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={submitting}
              placeholder="논문 제목"
              className={inputClass}
            />
          </div>
          <div>
            <label
              htmlFor="pub-authors"
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              저자 <span className="text-red-500">*</span>
            </label>
            <input
              id="pub-authors"
              type="text"
              value={authors}
              onChange={(e) => setAuthors(e.target.value)}
              disabled={submitting}
              placeholder="홍길동, 김철수"
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="pub-venue"
                className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                학회/저널
              </label>
              <input
                id="pub-venue"
                type="text"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                disabled={submitting}
                placeholder="게재처 (선택)"
                className={inputClass}
              />
            </div>
            <div>
              <label
                htmlFor="pub-year"
                className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                연도 <span className="text-red-500">*</span>
              </label>
              <input
                id="pub-year"
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                disabled={submitting}
                min={1990}
                max={2100}
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label
              htmlFor="pub-link"
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              링크
            </label>
            <input
              id="pub-link"
              type="text"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              disabled={submitting}
              placeholder="DOI 또는 논문 URL (선택)"
              className={inputClass}
            />
          </div>
          {formError && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {formError}
            </p>
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "등록 중..." : "등록"}
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 space-y-6">
        {loading ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">
            {t.loading}
          </p>
        ) : pubs.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-10 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t.empty}
            </p>
          </div>
        ) : (
          years.map((y) => (
            <section key={y}>
              <h2 className="text-lg font-semibold text-blue-700 dark:text-blue-400">
                {y}
              </h2>
              <ul className="mt-2 space-y-2">
                {byYear(y).map((p) => (
                  <li
                    key={p.id}
                    className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
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
                        <p className="mt-1 break-words text-sm text-gray-600 dark:text-gray-400">
                          {p.authors}
                          {p.venue && ` · ${p.venue}`}
                        </p>
                      </div>
                      {canManage &&
                        (confirmDeleteId === p.id ? (
                          <span className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={() => remove(p)}
                              disabled={busyId === p.id}
                              className="rounded-md bg-red-600 px-2 py-0.5 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                            >
                              정말 삭제
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              disabled={busyId === p.id}
                              className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            >
                              취소
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(p.id)}
                            className="shrink-0 text-xs text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                          >
                            삭제
                          </button>
                        ))}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
