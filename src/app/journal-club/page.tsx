"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import AuthGuard from "@/components/AuthGuard";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { extractDoi, fetchDoiMeta } from "@/lib/doi";
import { formatDate } from "@/lib/dates";
import { Reading } from "@/types";

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500";

function readingMillis(r: Reading): number {
  return r.createdAt ? r.createdAt.toMillis() : Number.MAX_SAFE_INTEGER;
}

function JournalClubContent() {
  const { user, profile } = useAuth();
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");
  const [presenterName, setPresenterName] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [doiInput, setDoiInput] = useState("");
  const [doiFetching, setDoiFetching] = useState(false);
  const [doiMessage, setDoiMessage] = useState<string | null>(null);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "readings"),
      (snap) => {
        setReadings(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Reading)
        );
        setLoadError(null);
        setLoading(false);
      },
      () => {
        setLoadError(
          "저널클럽 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요."
        );
        setLoading(false);
      }
    );
    return unsubscribe;
  }, []);

  if (!user) return null;

  // 발표 예정일이 있으면 빠른 순, 없으면 등록 순
  const queued = readings
    .filter((r) => r.status === "queued")
    .sort((a, b) => {
      const ad = a.scheduledDate || "9999-99-99";
      const bd = b.scheduledDate || "9999-99-99";
      if (ad !== bd) return ad < bd ? -1 : 1;
      return readingMillis(a) - readingMillis(b);
    });
  const done = readings
    .filter((r) => r.status === "done")
    .sort((a, b) => {
      const ad = a.scheduledDate || "0000-00-00";
      const bd = b.scheduledDate || "0000-00-00";
      return ad < bd ? 1 : -1;
    });

  const importFromDoi = async () => {
    if (doiFetching) return;
    const doi = extractDoi(doiInput);
    if (!doi) {
      setDoiMessage("DOI를 찾지 못했습니다. 예: 10.1234/abcd 또는 doi.org 링크");
      return;
    }
    setDoiFetching(true);
    setDoiMessage(null);
    try {
      const meta = await fetchDoiMeta(doi);
      if (!meta) {
        setDoiMessage("DOI 정보를 가져오지 못했습니다. 직접 입력해주세요.");
        return;
      }
      if (meta.title) setTitle(meta.title);
      setLink(meta.link);
      setDoiMessage("가져왔습니다. 발표자·날짜를 정하고 등록하세요.");
    } catch {
      setDoiMessage("DOI 정보를 가져오지 못했습니다. 직접 입력해주세요.");
    } finally {
      setDoiFetching(false);
    }
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile || submitting) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setFormError("논문 제목을 입력하세요.");
      return;
    }
    if (scheduledDate && !/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) {
      setFormError("발표 예정일이 올바르지 않습니다.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await addDoc(collection(db, "readings"), {
        title: trimmedTitle,
        link: link.trim(),
        presenterName: presenterName.trim(),
        scheduledDate,
        status: "queued",
        createdBy: user.uid,
        createdByName: profile.name,
        createdAt: serverTimestamp(),
      });
      setTitle("");
      setLink("");
      setPresenterName("");
      setScheduledDate("");
      setDoiInput("");
      setDoiMessage(null);
      setShowForm(false);
    } catch {
      setFormError("등록에 실패했습니다. 잠시 후 다시 시도하세요.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (r: Reading) => {
    setBusyId(r.id);
    setActionError(null);
    try {
      await updateDoc(doc(db, "readings", r.id), {
        status: r.status === "queued" ? "done" : "queued",
      });
    } catch {
      setActionError("상태 변경에 실패했습니다.");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (r: Reading) => {
    setBusyId(r.id);
    setActionError(null);
    try {
      await deleteDoc(doc(db, "readings", r.id));
    } catch {
      setActionError("삭제에 실패했습니다.");
    } finally {
      setBusyId(null);
      setConfirmDeleteId(null);
    }
  };

  const renderItem = (r: Reading) => {
    const canDelete = isAdmin || r.createdBy === user.uid;
    return (
      <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          {r.link ? (
            <a
              href={r.link}
              target="_blank"
              rel="noopener noreferrer"
              className="break-words text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              {r.title}
            </a>
          ) : (
            <p className="break-words text-sm font-medium text-gray-900 dark:text-gray-100">
              {r.title}
            </p>
          )}
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {r.presenterName ? `발표: ${r.presenterName}` : "발표자 미정"}
            {r.scheduledDate && ` · ${r.scheduledDate}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => toggleStatus(r)}
          disabled={busyId === r.id}
          className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
            r.status === "queued"
              ? "bg-green-600 text-white hover:bg-green-700"
              : "border border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          }`}
        >
          {r.status === "queued" ? "발표 완료" : "다시 큐로"}
        </button>
        {canDelete &&
          (confirmDeleteId === r.id ? (
            <span className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => remove(r)}
                disabled={busyId === r.id}
                className="rounded-md bg-red-600 px-2 py-0.5 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                정말 삭제
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                disabled={busyId === r.id}
                className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                취소
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDeleteId(r.id)}
              disabled={busyId === r.id}
              className="shrink-0 text-xs text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
            >
              삭제
            </button>
          ))}
      </li>
    );
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          저널클럽
        </h1>
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
      </div>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        함께 읽을 논문을 쌓아두고, 발표자와 날짜를 정해 소화합니다.
      </p>

      {loadError && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/50 dark:text-red-400">
          {loadError}
        </p>
      )}
      {actionError && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/50 dark:text-red-400">
          {actionError}
        </p>
      )}

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mt-4 space-y-3 rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900"
        >
          <div className="rounded-md border border-blue-100 bg-blue-50/50 p-3 dark:border-blue-950 dark:bg-blue-950/20">
            <label
              htmlFor="reading-doi"
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              DOI로 자동 입력
            </label>
            <div className="flex gap-2">
              <input
                id="reading-doi"
                type="text"
                value={doiInput}
                onChange={(e) => setDoiInput(e.target.value)}
                disabled={doiFetching}
                placeholder="10.1234/abcd 또는 https://doi.org/..."
                className={inputClass}
              />
              <button
                type="button"
                onClick={importFromDoi}
                disabled={doiFetching}
                className="shrink-0 rounded-md border border-blue-600 px-3 py-2 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50 disabled:opacity-50 dark:border-blue-500 dark:text-blue-400 dark:hover:bg-blue-950/40"
              >
                {doiFetching ? "가져오는 중..." : "가져오기"}
              </button>
            </div>
            {doiMessage && (
              <p className="mt-1.5 text-xs text-gray-600 dark:text-gray-400">
                {doiMessage}
              </p>
            )}
          </div>
          <div>
            <label
              htmlFor="reading-title"
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              논문 제목 <span className="text-red-500">*</span>
            </label>
            <input
              id="reading-title"
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
              htmlFor="reading-link"
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              링크
            </label>
            <input
              id="reading-link"
              type="text"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              disabled={submitting}
              placeholder="논문 URL (선택)"
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="reading-presenter"
                className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                발표자
              </label>
              <input
                id="reading-presenter"
                type="text"
                value={presenterName}
                onChange={(e) => setPresenterName(e.target.value)}
                disabled={submitting}
                placeholder="이름 (선택 — 나중에 정해도 됩니다)"
                className={inputClass}
              />
            </div>
            <div>
              <label
                htmlFor="reading-date"
                className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                발표 예정일
              </label>
              <input
                id="reading-date"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                disabled={submitting}
                className={inputClass}
              />
            </div>
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

      <section className="mt-6">
        <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
          읽을 논문{" "}
          <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
            {queued.length}편
          </span>
        </h2>
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          {loading ? (
            <p className="p-6 text-center text-sm text-gray-400 dark:text-gray-500">
              불러오는 중...
            </p>
          ) : queued.length === 0 ? (
            <p className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
              대기 중인 논문이 없습니다. &quot;논문 추가&quot;로 쌓아보세요.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {queued.map(renderItem)}
            </ul>
          )}
        </div>
      </section>

      {done.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
            발표 완료{" "}
            <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
              {done.length}편
            </span>
          </h2>
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {done.map(renderItem)}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}

export default function JournalClubPage() {
  return (
    <AuthGuard>
      <JournalClubContent />
    </AuthGuard>
  );
}
