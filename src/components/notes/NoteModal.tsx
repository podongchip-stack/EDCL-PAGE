"use client";

import { FormEvent, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import Modal from "@/components/ui/Modal";
import { useAuth } from "@/contexts/AuthContext";
import { formatDate } from "@/lib/dates";
import { INPUT_CLASS, LABEL_CLASS } from "@/lib/formStyles";
import { MeetingNote } from "@/types";

interface NoteModalProps {
  note: MeetingNote | null; // null이면 새 회의록 작성
  onClose: () => void;
}

export default function NoteModal({ note, onClose }: NoteModalProps) {
  const { user, profile } = useAuth();
  const [mode, setMode] = useState<"view" | "form">(note ? "view" : "form");

  const [title, setTitle] = useState(note?.title ?? "");
  const [date, setDate] = useState(note?.date ?? formatDate(new Date()));
  const [content, setContent] = useState(note?.content ?? "");

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const canManage =
    !!user &&
    !!profile &&
    !!note &&
    (note.createdBy === user.uid || profile.role === "admin");

  const startEdit = () => {
    if (!note) return;
    setTitle(note.title);
    setDate(note.date);
    setContent(note.content);
    setError(null);
    setMode("form");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !profile || submitting) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("회의록 제목을 입력하세요.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError("날짜를 선택하세요.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (note) {
        await updateDoc(doc(db, "meetingNotes", note.id), {
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
      onClose();
    } catch {
      setError("저장에 실패했습니다. 잠시 후 다시 시도하세요.");
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!note || submitting) return;
    setSubmitting(true);
    try {
      await deleteDoc(doc(db, "meetingNotes", note.id));
      onClose();
    } catch {
      setError("삭제에 실패했습니다. 잠시 후 다시 시도하세요.");
      setSubmitting(false);
    }
  };

  const heading = !note ? "회의록 작성" : mode === "view" ? "회의록" : "회의록 수정";

  return (
    <Modal onClose={onClose} title={heading} size="xl">
      <>
        {error && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/50 dark:text-red-400">
            {error}
          </p>
        )}

        {note && mode === "view" ? (
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {note.date} · {note.createdByName}
            </p>
            <h3 className="mt-1 text-lg font-semibold break-words text-gray-900 dark:text-gray-100">
              {note.title}
            </h3>
            <p className="mt-4 text-sm leading-relaxed break-words whitespace-pre-wrap text-gray-700 dark:text-gray-300">
              {note.content ? note.content : "내용이 없습니다."}
            </p>

            {canManage && (
              <div className="mt-5 flex items-center justify-end gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">
                {confirmDelete ? (
                  <>
                    <span className="mr-auto text-sm text-gray-600 dark:text-gray-400">
                      이 회의록을 삭제할까요?
                    </span>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      disabled={submitting}
                      className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={submitting}
                      className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                    >
                      {submitting ? "삭제 중..." : "정말 삭제"}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      className="rounded-md px-3 py-1.5 text-sm text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                    >
                      삭제
                    </button>
                    <button
                      type="button"
                      onClick={startEdit}
                      className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                      수정
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
              <div>
                <label htmlFor="note-title" className={LABEL_CLASS}>
                  제목 <span className="text-red-500">*</span>
                </label>
                <input
                  id="note-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={submitting}
                  placeholder="예: 8월 첫째 주 랩미팅"
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label htmlFor="note-date" className={LABEL_CLASS}>
                  날짜 <span className="text-red-500">*</span>
                </label>
                <input
                  id="note-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={submitting}
                  className={INPUT_CLASS}
                />
              </div>
            </div>
            <div>
              <label htmlFor="note-content" className={LABEL_CLASS}>
                내용
              </label>
              <textarea
                id="note-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={12}
                disabled={submitting}
                placeholder="논의 내용, 결정 사항, 할 일 등"
                className={INPUT_CLASS}
              />
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">
              <button
                type="button"
                onClick={() => {
                  if (note) {
                    setError(null);
                    setMode("view");
                  } else {
                    onClose();
                  }
                }}
                disabled={submitting}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? "저장 중..." : "저장"}
              </button>
            </div>
          </form>
        )}
      </>
    </Modal>
  );
}
