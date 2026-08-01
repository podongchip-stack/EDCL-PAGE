"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
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
import { formatDate } from "@/lib/dates";
import { MeetingNote } from "@/types";

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500";

function NotesContent() {
  const { user, profile } = useAuth();
  const searchParams = useSearchParams();
  const initialNoteId = searchParams.get("note");

  const [notes, setNotes] = useState<MeetingNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(
    initialNoteId ?? null
  );
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(formatDate(new Date()));
  const [content, setContent] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "meetingNotes"),
      (snap) => {
        setNotes(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MeetingNote)
        );
        setLoadError(null);
        setLoading(false);
      },
      () => {
        setLoadError("회의록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
        setLoading(false);
      }
    );
    return unsubscribe;
  }, []);

  // 검색 딥링크로 파라미터만 바뀌어도 해당 회의록이 펼쳐지도록
  useEffect(() => {
    if (initialNoteId) setExpandedId(initialNoteId);
  }, [initialNoteId]);

  if (!user) return null;

  const sorted = [...notes].sort((a, b) => (a.date < b.date ? 1 : -1));

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setDate(formatDate(new Date()));
    setContent("");
    setFormError(null);
  };

  const startEdit = (note: MeetingNote) => {
    setEditingId(note.id);
    setTitle(note.title);
    setDate(note.date);
    setContent(note.content);
    setFormError(null);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile || submitting) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setFormError("회의록 제목을 입력하세요.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setFormError("날짜를 선택하세요.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      if (editingId) {
        await updateDoc(doc(db, "meetingNotes", editingId), {
          title: trimmedTitle,
          date,
          content: content.trim(),
        });
      } else {
        await addDoc(collection(db, "meetingNotes"), {
          title: trimmedTitle,
          date,
          content: content.trim(),
          createdBy: user.uid,
          createdByName: profile.name,
          createdAt: serverTimestamp(),
        });
      }
      resetForm();
      setShowForm(false);
    } catch {
      setFormError("저장에 실패했습니다. 잠시 후 다시 시도하세요.");
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (note: MeetingNote) => {
    setBusyId(note.id);
    try {
      await deleteDoc(doc(db, "meetingNotes", note.id));
    } finally {
      setBusyId(null);
      setConfirmDeleteId(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          회의록
        </h1>
        <button
          type="button"
          onClick={() => {
            if (showForm) {
              resetForm();
              setShowForm(false);
            } else {
              setShowForm(true);
            }
          }}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          {showForm ? "닫기" : "회의록 작성"}
        </button>
      </div>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        미팅·세미나 기록을 날짜별로 남깁니다. 제목을 누르면 내용이 펼쳐집니다.
      </p>

      {loadError && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/50 dark:text-red-400">
          {loadError}
        </p>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mt-4 space-y-3 rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
            <div>
              <label
                htmlFor="note-title"
                className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                제목 <span className="text-red-500">*</span>
              </label>
              <input
                id="note-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={submitting}
                placeholder="예: 8월 첫째 주 랩미팅"
                className={inputClass}
              />
            </div>
            <div>
              <label
                htmlFor="note-date"
                className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                날짜 <span className="text-red-500">*</span>
              </label>
              <input
                id="note-date"
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
              htmlFor="note-content"
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              내용
            </label>
            <textarea
              id="note-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              disabled={submitting}
              placeholder="논의 내용, 결정 사항, 할 일 등"
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
              {submitting ? "저장 중..." : editingId ? "수정 저장" : "등록"}
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        {loading ? (
          <p className="p-6 text-center text-sm text-gray-400 dark:text-gray-500">
            불러오는 중...
          </p>
        ) : sorted.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              작성된 회의록이 없습니다.
            </p>
            <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
              &quot;회의록 작성&quot; 버튼으로 첫 기록을 남겨보세요.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {sorted.map((note) => {
              const expanded = expandedId === note.id;
              const canManage = isAdmin || note.createdBy === user.uid;
              return (
                <li key={note.id} className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : note.id)}
                    className="flex w-full items-center gap-3 text-left"
                  >
                    <span className="shrink-0 text-sm text-gray-500 dark:text-gray-400">
                      {note.date}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                      {note.title}
                    </span>
                    <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
                      {note.createdByName}
                    </span>
                  </button>
                  {expanded && (
                    <div className="mt-2 rounded-md bg-gray-50 px-3 py-2 dark:bg-gray-800/50">
                      <p className="whitespace-pre-wrap break-words text-sm text-gray-700 dark:text-gray-300">
                        {note.content ? note.content : "내용이 없습니다."}
                      </p>
                      {canManage && (
                        <div className="mt-2 flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(note)}
                            disabled={busyId === note.id}
                            className="text-xs text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
                          >
                            수정
                          </button>
                          {confirmDeleteId === note.id ? (
                            <>
                              <button
                                type="button"
                                onClick={() => remove(note)}
                                disabled={busyId === note.id}
                                className="rounded-md bg-red-600 px-2 py-0.5 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                              >
                                정말 삭제
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                disabled={busyId === note.id}
                                className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                              >
                                취소
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(note.id)}
                              disabled={busyId === note.id}
                              className="text-xs text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                            >
                              삭제
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function NotesPage() {
  return (
    <AuthGuard>
      {/* useSearchParams 사용 컴포넌트는 Suspense 경계가 필요하다 */}
      <Suspense fallback={null}>
        <NotesContent />
      </Suspense>
    </AuthGuard>
  );
}
