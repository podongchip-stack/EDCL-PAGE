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
import { formatDate } from "@/lib/dates";
import { publicStrings } from "@/lib/publicStrings";
import { NewsItem } from "@/types";

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500";

// 공개 페이지 — 소식은 누구나 볼 수 있고, 작성·삭제는 관리자만
export default function NewsPage() {
  const { profile } = useAuth();
  const { lang } = useLanguage();
  const t = publicStrings(lang).news;
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [date, setDate] = useState(formatDate(new Date()));
  const [link, setLink] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "news"),
      (snap) => {
        setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as NewsItem));
        setLoadError(false);
        setLoading(false);
      },
      () => {
        setLoadError(true);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, []);

  const sorted = [...items].sort((a, b) => (a.date < b.date ? 1 : -1));

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!isAdmin || submitting) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setFormError("소식 제목을 입력하세요.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setFormError("날짜를 선택하세요.");
      return;
    }
    // 스킴 없는 링크는 상대 경로로 해석돼 깨지므로 https://를 붙여준다
    let normalizedLink = link.trim();
    if (normalizedLink && !/^https?:\/\//i.test(normalizedLink)) {
      normalizedLink = `https://${normalizedLink}`;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await addDoc(collection(db, "news"), {
        title: trimmedTitle,
        content: content.trim(),
        date,
        link: normalizedLink,
        createdBy: profile ? profile.uid : "",
        createdAt: serverTimestamp(),
      });
      setTitle("");
      setContent("");
      setLink("");
      setShowForm(false);
    } catch {
      setFormError("등록에 실패했습니다. 잠시 후 다시 시도하세요.");
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (item: NewsItem) => {
    setBusyId(item.id);
    try {
      await deleteDoc(doc(db, "news", item.id));
    } finally {
      setBusyId(null);
      setConfirmDeleteId(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {t.title}
        </h1>
        {isAdmin && (
          <button
            type="button"
            onClick={() => {
              setShowForm((v) => !v);
              setFormError(null);
            }}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            {showForm ? "닫기" : "소식 작성"}
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

      {showForm && isAdmin && (
        <form
          onSubmit={handleCreate}
          className="mt-4 space-y-3 rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
            <div>
              <label
                htmlFor="news-title"
                className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                제목 <span className="text-red-500">*</span>
              </label>
              <input
                id="news-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={submitting}
                placeholder="예: OO 학회 논문 게재"
                className={inputClass}
              />
            </div>
            <div>
              <label
                htmlFor="news-date"
                className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                날짜 <span className="text-red-500">*</span>
              </label>
              <input
                id="news-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={submitting}
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label
              htmlFor="news-content"
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              내용
            </label>
            <textarea
              id="news-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              disabled={submitting}
              placeholder="소식 내용 (선택)"
              className={inputClass}
            />
          </div>
          <div>
            <label
              htmlFor="news-link"
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              링크
            </label>
            <input
              id="news-link"
              type="text"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              disabled={submitting}
              placeholder="관련 링크 (선택)"
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
          </div>
        ) : (
          <ol className="relative space-y-6 border-l border-gray-200 pl-6 dark:border-gray-800">
            {sorted.map((n) => (
              <li key={n.id} className="relative">
                <span className="absolute -left-[1.85rem] top-1.5 h-2.5 w-2.5 rounded-full bg-blue-500" />
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {n.date}
                </p>
                <div className="mt-0.5 flex flex-wrap items-start justify-between gap-2">
                  <p className="break-words text-base font-semibold text-gray-900 dark:text-gray-100">
                    {n.title}
                  </p>
                  {isAdmin &&
                    (confirmDeleteId === n.id ? (
                      <span className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => remove(n)}
                          disabled={busyId === n.id}
                          className="rounded-md bg-red-600 px-2 py-0.5 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                        >
                          정말 삭제
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          disabled={busyId === n.id}
                          className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                          취소
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(n.id)}
                        className="shrink-0 text-xs text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                      >
                        삭제
                      </button>
                    ))}
                </div>
                {n.content && (
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-600 dark:text-gray-400">
                    {n.content}
                  </p>
                )}
                {n.link && (
                  <a
                    href={n.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block break-all text-xs text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {n.link}
                  </a>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
