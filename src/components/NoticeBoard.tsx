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
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Notice } from "@/types";
import { formatDate, tsToDate } from "@/lib/dates";

const MAX_VISIBLE = 5;

// serverTimestamp가 아직 반영되지 않은 로컬 스냅샷(createdAt null)은 최신으로 취급
function noticeMillis(n: Notice): number {
  return n.createdAt ? n.createdAt.toMillis() : Number.MAX_SAFE_INTEGER;
}

export default function NoticeBoard() {
  const { user, profile } = useAuth();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [pinned, setPinned] = useState(false);

  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "notices"),
      (snap) => {
        setNotices(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Notice));
        setLoadError(null);
        setLoading(false);
      },
      () => {
        setLoadError("공지사항을 불러오지 못했습니다.");
        setLoading(false);
      }
    );
    return unsubscribe;
  }, []);

  const sorted = [...notices].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return noticeMillis(b) - noticeMillis(a);
  });
  const visible = showAll ? sorted : sorted.slice(0, MAX_VISIBLE);
  const hiddenCount = sorted.length - MAX_VISIBLE;

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !profile || busy) return;
    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();
    if (!trimmedTitle) {
      setActionError("공지 제목을 입력하세요.");
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      await addDoc(collection(db, "notices"), {
        title: trimmedTitle,
        content: trimmedContent,
        pinned,
        createdBy: user.uid,
        createdByName: profile.name,
        createdAt: serverTimestamp(),
      });
      setTitle("");
      setContent("");
      setPinned(false);
      setShowForm(false);
    } catch {
      setActionError("공지 등록에 실패했습니다. 잠시 후 다시 시도하세요.");
    } finally {
      setBusy(false);
    }
  };

  const togglePin = async (notice: Notice) => {
    if (busy) return;
    setBusy(true);
    setActionError(null);
    try {
      await updateDoc(doc(db, "notices", notice.id), { pinned: !notice.pinned });
    } catch {
      setActionError("고정 상태 변경에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (notice: Notice) => {
    if (busy) return;
    setBusy(true);
    setActionError(null);
    try {
      await deleteDoc(doc(db, "notices", notice.id));
    } catch {
      setActionError("공지 삭제에 실패했습니다.");
    } finally {
      setBusy(false);
      setConfirmDeleteId(null);
    }
  };

  return (
    <section className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100">
          공지사항
        </h2>
        {isAdmin && (
          <button
            type="button"
            onClick={() => {
              setShowForm((v) => !v);
              setActionError(null);
            }}
            className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            {showForm ? "닫기" : "+ 공지 작성"}
          </button>
        )}
      </div>

      {showForm && isAdmin && (
        <form
          onSubmit={handleCreate}
          className="space-y-2 border-b border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800/50"
        >
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="공지 제목 (필수)"
            aria-label="공지 제목"
            disabled={busy}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            placeholder="공지 내용 (선택)"
            aria-label="공지 내용"
            disabled={busy}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500"
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={pinned}
                onChange={(e) => setPinned(e.target.checked)}
                disabled={busy}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              상단 고정
            </label>
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {busy ? "등록 중..." : "등록"}
            </button>
          </div>
        </form>
      )}

      <div className="px-4 py-3">
        {actionError && (
          <p className="mb-2 text-sm text-red-600 dark:text-red-400">
            {actionError}
          </p>
        )}
        {loadError ? (
          <p className="py-4 text-sm text-red-600 dark:text-red-400">
            {loadError}
          </p>
        ) : loading ? (
          <p className="py-4 text-sm text-gray-400 dark:text-gray-500">
            불러오는 중...
          </p>
        ) : visible.length === 0 ? (
          <p className="py-4 text-sm text-gray-500 dark:text-gray-400">
            등록된 공지가 없습니다.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {visible.map((n) => {
              const expanded = expandedId === n.id;
              const created = tsToDate(n.createdAt);
              return (
                <li key={n.id} className="py-2.5">
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : n.id)}
                    className="flex w-full items-center gap-2 text-left"
                  >
                    {n.pinned && (
                      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                        고정
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                      {n.title}
                    </span>
                    <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
                      {created ? formatDate(created) : ""}
                    </span>
                  </button>
                  {expanded && (
                    <div className="mt-2 rounded-md bg-gray-50 px-3 py-2 dark:bg-gray-800/50">
                      <p className="whitespace-pre-wrap break-words text-sm text-gray-700 dark:text-gray-300">
                        {n.content ? n.content : "내용이 없습니다."}
                      </p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {n.createdByName}
                        </span>
                        {isAdmin && (
                          <span className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => togglePin(n)}
                              disabled={busy}
                              className="text-xs text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
                            >
                              {n.pinned ? "고정 해제" : "고정"}
                            </button>
                            {confirmDeleteId === n.id ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => remove(n)}
                                  disabled={busy}
                                  className="rounded-md bg-red-600 px-2 py-0.5 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                                >
                                  정말 삭제
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  disabled={busy}
                                  className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                >
                                  취소
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(n.id)}
                                disabled={busy}
                                className="text-xs text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                              >
                                삭제
                              </button>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="mt-1 w-full rounded-md py-1.5 text-center text-sm font-medium text-blue-600 transition-colors hover:bg-gray-50 dark:text-blue-400 dark:hover:bg-gray-800/60"
          >
            {showAll ? "접기" : `전체 보기 (외 ${hiddenCount}건)`}
          </button>
        )}
      </div>
    </section>
  );
}
