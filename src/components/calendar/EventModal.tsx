"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { LabEvent } from "@/types";
import { formatDate, isSameDay, tsToDate } from "@/lib/dates";

interface EventModalProps {
  event: LabEvent | null; // null이면 새 일정 등록
  defaultDate: Date | null; // 새 일정 등록 시 기본 날짜
  onClose: () => void;
}

// input 문자열을 로컬 시간 Date로 파싱 (UTC 해석 방지 위해 수동 파싱)
function parseDateOnly(v: string, endOfDay: boolean): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  return endOfDay ? new Date(y, mo, d, 23, 59, 59) : new Date(y, mo, d, 0, 0, 0);
}

function renderRange(ev: LabEvent): string {
  const s = tsToDate(ev.start);
  const e = tsToDate(ev.end);
  if (!s || !e) return "";
  return isSameDay(s, e) ? formatDate(s) : `${formatDate(s)} ~ ${formatDate(e)}`;
}

export default function EventModal({
  event,
  defaultDate,
  onClose,
}: EventModalProps) {
  const { user, profile } = useAuth();

  // 기존 일정은 상세 보기부터, 새 일정은 바로 폼
  const [mode, setMode] = useState<"view" | "form">(event ? "view" : "form");

  const baseDateStr = formatDate(defaultDate ?? new Date());
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startInput, setStartInput] = useState(baseDateStr);
  const [endInput, setEndInput] = useState(baseDateStr);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const canManage =
    !!user &&
    !!profile &&
    !!event &&
    (event.createdBy === user.uid || profile.role === "admin");

  const startEdit = () => {
    if (!event) return;
    const s = tsToDate(event.start) ?? new Date();
    const e = tsToDate(event.end) ?? s;
    setTitle(event.title);
    setDescription(event.description);
    setStartInput(formatDate(s));
    setEndInput(formatDate(e));
    setError(null);
    setConfirmDelete(false);
    setMode("form");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !profile || submitting) return;

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("제목을 입력해주세요.");
      return;
    }
    const startDate = parseDateOnly(startInput, false);
    const endDate = parseDateOnly(endInput, true);
    if (!startDate || !endDate) {
      setError("시작/종료 날짜를 모두 입력해주세요.");
      return;
    }
    if (endDate < startDate) {
      setError("종료 날짜가 시작 날짜보다 빠를 수 없습니다.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      if (event) {
        await updateDoc(doc(db, "events", event.id), {
          title: trimmedTitle,
          description: description.trim(),
          start: Timestamp.fromDate(startDate),
          end: Timestamp.fromDate(endDate),
        });
      } else {
        await addDoc(collection(db, "events"), {
          title: trimmedTitle,
          description: description.trim(),
          start: Timestamp.fromDate(startDate),
          end: Timestamp.fromDate(endDate),
          createdBy: user.uid,
          createdByName: profile.name,
          createdAt: serverTimestamp(),
        });
      }
      onClose();
    } catch {
      setError("일정 저장에 실패했습니다. 잠시 후 다시 시도해주세요.");
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!event || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await deleteDoc(doc(db, "events", event.id));
      onClose();
    } catch {
      setError("일정 삭제에 실패했습니다. 잠시 후 다시 시도해주세요.");
      setSubmitting(false);
    }
  };

  const heading = !event ? "새 일정 등록" : mode === "view" ? "일정 상세" : "일정 수정";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg border border-gray-200 bg-white p-6 shadow-lg dark:border-gray-800 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {heading}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            닫기
          </button>
        </div>

        {error && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/50 dark:text-red-400">
            {error}
          </p>
        )}

        {event && mode === "view" ? (
          <div>
            <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {event.title}
            </p>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {renderRange(event)}
            </p>
            <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
              {event.description ? event.description : "설명이 없습니다."}
            </p>
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              작성자: {event.createdByName}
            </p>

            {canManage && (
              <div className="mt-5 flex items-center justify-end gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">
                {confirmDelete ? (
                  <>
                    <span className="mr-1 text-sm text-red-600 dark:text-red-400">
                      정말 삭제할까요?
                    </span>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={submitting}
                      className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                    >
                      정말 삭제
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      disabled={submitting}
                      className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                      취소
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={startEdit}
                      className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
                    >
                      삭제
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="event-title"
                className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                제목 <span className="text-red-500">*</span>
              </label>
              <input
                id="event-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="일정 제목"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
              />
            </div>

            <div>
              <label
                htmlFor="event-description"
                className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                설명
              </label>
              <textarea
                id="event-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="일정 설명 (선택)"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="event-start"
                  className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  시작일
                </label>
                <input
                  id="event-start"
                  type="date"
                  value={startInput}
                  onChange={(e) => setStartInput(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                />
              </div>
              <div>
                <label
                  htmlFor="event-end"
                  className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  종료일
                </label>
                <input
                  id="event-end"
                  type="date"
                  value={endInput}
                  onChange={(e) => setEndInput(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">
              <button
                type="button"
                onClick={() => {
                  if (event) {
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
      </div>
    </div>
  );
}
