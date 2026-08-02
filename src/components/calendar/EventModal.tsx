"use client";

import { FormEvent, useState } from "react";
import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import Modal from "@/components/ui/Modal";
import { useAuth } from "@/contexts/AuthContext";
import { EVENT_CATEGORY_LABELS, EventCategory, LabEvent } from "@/types";
import {
  EVENT_CATEGORY_ORDER,
  eventCategory,
  eventCategoryStyle,
} from "@/lib/eventCategories";
import { formatDate, isSameDay, tsToDate } from "@/lib/dates";

interface EventModalProps {
  event: LabEvent | null; // null이면 새 일정 등록
  defaultDate: Date | null; // 새 일정 등록 시 기본 날짜
  onClose: () => void;
}

const REPEAT_OPTIONS = [
  { value: "none", label: "반복 안 함" },
  { value: "weekly", label: "매주" },
  { value: "biweekly", label: "2주마다" },
  { value: "monthly", label: "매월" },
] as const;

type RepeatOption = (typeof REPEAT_OPTIONS)[number]["value"];

const MAX_OCCURRENCES = 52;

// input 문자열을 로컬 시간 Date로 파싱 (UTC 해석 방지 위해 수동 파싱)
function parseDateOnly(v: string, endOfDay: boolean): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  return endOfDay ? new Date(y, mo, d, 23, 59, 59) : new Date(y, mo, d, 0, 0, 0);
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

// i번째 반복 회차의 시작일. 매월 반복은 말일 초과를 그 달의 마지막 날로 보정한다.
function occurrenceStart(base: Date, repeat: RepeatOption, i: number): Date {
  if (repeat === "monthly") {
    const year = base.getFullYear();
    const month = base.getMonth() + i;
    const day = Math.min(base.getDate(), daysInMonth(year, month));
    return new Date(year, month, day);
  }
  const step = repeat === "weekly" ? 7 : 14;
  return new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate() + step * i
  );
}

function renderRange(ev: LabEvent): string {
  const s = tsToDate(ev.start);
  const e = tsToDate(ev.end);
  if (!s || !e) return "";
  return isSameDay(s, e) ? formatDate(s) : `${formatDate(s)} ~ ${formatDate(e)}`;
}

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500";

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
  const [category, setCategory] = useState<EventCategory>("etc");
  const [startInput, setStartInput] = useState(baseDateStr);
  const [endInput, setEndInput] = useState(baseDateStr);
  const [repeat, setRepeat] = useState<RepeatOption>("none");
  const [repeatUntilInput, setRepeatUntilInput] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

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
    setCategory(eventCategory(event));
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

    const baseData = {
      title: trimmedTitle,
      description: description.trim(),
      category,
    };

    // 반복 회차 생성 (새 일정 + 반복 선택 시)
    let occurrences: { start: Date; end: Date }[] | null = null;
    if (!event && repeat !== "none") {
      const repeatEnd = parseDateOnly(repeatUntilInput, false);
      if (!repeatEnd) {
        setError("반복 종료일을 입력해주세요.");
        return;
      }
      if (repeatEnd < startDate) {
        setError("반복 종료일이 시작 날짜보다 빠를 수 없습니다.");
        return;
      }
      const durationDays = Math.round(
        (new Date(
          endDate.getFullYear(),
          endDate.getMonth(),
          endDate.getDate()
        ).getTime() -
          startDate.getTime()) /
          86400000
      );
      occurrences = [];
      for (let i = 0; ; i++) {
        const s = occurrenceStart(startDate, repeat, i);
        if (s > repeatEnd) break;
        if (occurrences.length >= MAX_OCCURRENCES) {
          setError(
            `반복 일정은 최대 ${MAX_OCCURRENCES}회까지 등록할 수 있습니다. 반복 종료일을 앞당겨주세요.`
          );
          return;
        }
        occurrences.push({
          start: s,
          end: new Date(
            s.getFullYear(),
            s.getMonth(),
            s.getDate() + durationDays,
            23,
            59,
            59
          ),
        });
      }
    }

    setSubmitting(true);
    setError(null);
    try {
      if (event) {
        await updateDoc(doc(db, "events", event.id), {
          ...baseData,
          start: Timestamp.fromDate(startDate),
          end: Timestamp.fromDate(endDate),
        });
      } else if (occurrences) {
        const batch = writeBatch(db);
        for (const occ of occurrences) {
          batch.set(doc(collection(db, "events")), {
            ...baseData,
            start: Timestamp.fromDate(occ.start),
            end: Timestamp.fromDate(occ.end),
            createdBy: user.uid,
            createdByName: profile.name,
            createdAt: serverTimestamp(),
          });
        }
        await batch.commit();
      } else {
        await addDoc(collection(db, "events"), {
          ...baseData,
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
    <Modal onClose={onClose} title={heading} size="md">
      <>
        {error && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/50 dark:text-red-400">
            {error}
          </p>
        )}

        {event && mode === "view" ? (
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${eventCategoryStyle(event).badge}`}
              >
                {eventCategoryStyle(event).label}
              </span>
              <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                {event.title}
              </p>
            </div>
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
                className={inputClass}
              />
            </div>

            <div>
              <label
                htmlFor="event-category"
                className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                분류
              </label>
              <select
                id="event-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as EventCategory)}
                className={inputClass}
              >
                {EVENT_CATEGORY_ORDER.map((c) => (
                  <option key={c} value={c}>
                    {EVENT_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
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
                className={inputClass}
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
                  className={inputClass}
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
                  className={inputClass}
                />
              </div>
            </div>

            {!event && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="event-repeat"
                    className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    반복
                  </label>
                  <select
                    id="event-repeat"
                    value={repeat}
                    onChange={(e) => setRepeat(e.target.value as RepeatOption)}
                    className={inputClass}
                  >
                    {REPEAT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                {repeat !== "none" && (
                  <div>
                    <label
                      htmlFor="event-repeat-until"
                      className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      반복 종료일
                    </label>
                    <input
                      id="event-repeat-until"
                      type="date"
                      value={repeatUntilInput}
                      onChange={(e) => setRepeatUntilInput(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                )}
              </div>
            )}
            {!event && repeat !== "none" && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                각 회차는 개별 일정으로 등록되며, 수정·삭제도 회차별로 합니다.
              </p>
            )}

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
      </>
    </Modal>
  );
}
