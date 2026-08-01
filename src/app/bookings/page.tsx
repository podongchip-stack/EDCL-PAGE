"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import AuthGuard from "@/components/AuthGuard";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { BookableItem, Booking } from "@/types";
import { formatDate, minToTime, timeToMin } from "@/lib/dates";

const inputClass =
  "rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500";

// 타임라인 표시 범위 (07:00 ~ 23:00)
const DAY_START = 7 * 60;
const DAY_END = 23 * 60;

// "YYYY-MM-DD"에 일수를 더한다
function addDaysToDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return formatDate(new Date(y, m - 1, d + days));
}

function BookingsContent() {
  const { user, profile } = useAuth();
  const [items, setItems] = useState<BookableItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [date, setDate] = useState(formatDate(new Date()));
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [purpose, setPurpose] = useState("");
  const [repeat, setRepeat] = useState<"none" | "weekly">("none");
  const [repeatCount, setRepeatCount] = useState("4");
  const [formError, setFormError] = useState<string | null>(null);
  const [formInfo, setFormInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "bookableItems"), (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as BookableItem)
        .sort((a, b) => a.name.localeCompare(b.name, "ko"));
      setItems(list);
      setItemsLoading(false);
      // 선택된 항목이 삭제됐거나 아직 없으면 첫 항목을 선택한다
      setSelectedItemId((prev) =>
        prev && list.some((i) => i.id === prev) ? prev : (list[0]?.id ?? null)
      );
    });
    return unsubscribe;
  }, []);

  // 선택한 항목·날짜의 예약 목록
  useEffect(() => {
    if (!selectedItemId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setBookings([]);
      return;
    }
    const unsubscribe = onSnapshot(
      query(
        collection(db, "bookings"),
        where("itemId", "==", selectedItemId),
        where("date", "==", date)
      ),
      (snap) => {
        setBookings(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Booking)
        );
        setLoadError(null);
      },
      () => {
        setLoadError("예약을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
      }
    );
    return unsubscribe;
  }, [selectedItemId, date]);

  // 내 예약 (오늘 이후)
  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(
      query(collection(db, "bookings"), where("createdBy", "==", user.uid)),
      (snap) => {
        const todayStr = formatDate(new Date());
        setMyBookings(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as Booking)
            .filter((b) => b.date >= todayStr)
            .sort((a, b) =>
              a.date === b.date ? a.startMin - b.startMin : a.date < b.date ? -1 : 1
            )
        );
      }
    );
    return unsubscribe;
  }, [user]);

  if (!user) return null;

  const selectedItem = items.find((i) => i.id === selectedItemId) ?? null;
  const sortedBookings = [...bookings].sort((a, b) => a.startMin - b.startMin);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile || !selectedItem || submitting) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setFormError("예약 날짜를 선택하세요.");
      return;
    }
    const startMin = timeToMin(startTime);
    const endMin = timeToMin(endTime);
    if (startMin === null || endMin === null) {
      setFormError("시작/종료 시간을 입력하세요.");
      return;
    }
    if (endMin <= startMin) {
      setFormError("종료 시간이 시작 시간보다 늦어야 합니다.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    setFormInfo(null);
    // 중간 회차 실패 시에도 이미 등록된 내역을 안내할 수 있게 try 밖에 둔다
    const created: string[] = [];
    const skipped: string[] = [];
    try {
      const count = repeat === "weekly" ? Number(repeatCount) : 1;
      const dates = Array.from({ length: count }, (_, i) =>
        addDaysToDateStr(date, 7 * i)
      );
      for (const targetDate of dates) {
        // 회차마다 제출 직전 서버에서 다시 조회해 겹침을 검사한다
        // (오래된 화면 상태나 거의 동시 제출로 인한 중복 방지)
        const freshSnap = await getDocs(
          query(
            collection(db, "bookings"),
            where("itemId", "==", selectedItem.id),
            where("date", "==", targetDate)
          )
        );
        const conflict = freshSnap.docs
          .map((d) => d.data() as Omit<Booking, "id">)
          .find((b) => startMin < b.endMin && endMin > b.startMin);
        if (conflict) {
          if (count === 1) {
            setFormError(
              `기존 예약(${minToTime(conflict.startMin)}~${minToTime(conflict.endMin)}, ${conflict.createdByName})과 시간이 겹칩니다.`
            );
            return;
          }
          skipped.push(targetDate);
          continue;
        }
        await addDoc(collection(db, "bookings"), {
          itemId: selectedItem.id,
          itemName: selectedItem.name,
          date: targetDate,
          startMin,
          endMin,
          purpose: purpose.trim(),
          createdBy: user.uid,
          createdByName: profile.name,
          createdAt: serverTimestamp(),
        });
        created.push(targetDate);
      }
      if (created.length === 0) {
        setFormError("모든 회차가 기존 예약과 겹쳐 등록하지 못했습니다.");
        return;
      }
      setPurpose("");
      if (count > 1) {
        setFormInfo(
          `${created.length}건 예약했습니다.` +
            (skipped.length > 0
              ? ` 겹친 ${skipped.length}건(${skipped.join(", ")})은 건너뛰었습니다.`
              : "")
        );
      }
    } catch {
      setFormError(
        created.length > 0
          ? `일부만 예약됐습니다 (${created.join(", ")}). 이후 회차 처리 중 오류가 발생했으니 남은 날짜만 다시 시도하세요.`
          : "예약에 실패했습니다. 잠시 후 다시 시도하세요."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (b: Booking) => {
    setBusyId(b.id);
    try {
      await deleteDoc(doc(db, "bookings", b.id));
    } finally {
      setBusyId(null);
      setConfirmDeleteId(null);
    }
  };

  const deleteControls = (b: Booking) => {
    const canManage = isAdmin || b.createdBy === user.uid;
    if (!canManage) return null;
    return confirmDeleteId === b.id ? (
      <span className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => remove(b)}
          disabled={busyId === b.id}
          className="rounded-md bg-red-600 px-2 py-0.5 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
        >
          정말 취소
        </button>
        <button
          type="button"
          onClick={() => setConfirmDeleteId(null)}
          disabled={busyId === b.id}
          className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          닫기
        </button>
      </span>
    ) : (
      <button
        type="button"
        onClick={() => setConfirmDeleteId(b.id)}
        disabled={busyId === b.id}
        className="shrink-0 text-xs text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
      >
        예약 취소
      </button>
    );
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        예약
      </h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        회의실·장비의 사용 시간을 예약합니다.
      </p>

      {loadError && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/50 dark:text-red-400">
          {loadError}
        </p>
      )}

      {itemsLoading ? (
        <p className="mt-6 text-sm text-gray-400 dark:text-gray-500">
          불러오는 중...
        </p>
      ) : items.length === 0 ? (
        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-10 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            예약 가능한 항목이 아직 없습니다.
          </p>
          <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
            관리자 페이지에서 회의실·장비 항목을 등록하면 여기서 예약할 수
            있습니다.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedItemId(item.id)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  selectedItemId === item.id
                    ? "bg-blue-600 text-white"
                    : "border border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                }`}
              >
                {item.name}
              </button>
            ))}
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-label="예약 날짜"
              className={`ml-auto ${inputClass}`}
            />
          </div>
          {selectedItem?.description && (
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {selectedItem.description}
            </p>
          )}

          <div className="mt-4 rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="border-b border-gray-200 px-4 py-3 font-semibold text-gray-900 dark:border-gray-800 dark:text-gray-100">
              {selectedItem?.name} · {date}
            </h2>
            {/* 하루 타임라인 (07:00~23:00) — 빈 시간대를 한눈에 */}
            <div className="px-4 pt-3">
              <div className="relative h-7 overflow-hidden rounded-md bg-gray-100 dark:bg-gray-800">
                {sortedBookings.map((b) => {
                  const s = Math.max(b.startMin, DAY_START);
                  const e = Math.min(b.endMin, DAY_END);
                  if (e <= s) return null;
                  const left = ((s - DAY_START) / (DAY_END - DAY_START)) * 100;
                  const width = ((e - s) / (DAY_END - DAY_START)) * 100;
                  return (
                    <div
                      key={b.id}
                      style={{ left: `${left}%`, width: `${width}%` }}
                      className="absolute top-0 h-full rounded-sm bg-blue-500/80"
                      title={`${minToTime(b.startMin)}~${minToTime(b.endMin)} · ${b.createdByName}`}
                    />
                  );
                })}
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-gray-400 dark:text-gray-500">
                <span>07:00</span>
                <span>11:00</span>
                <span>15:00</span>
                <span>19:00</span>
                <span>23:00</span>
              </div>
            </div>
            {sortedBookings.length === 0 ? (
              <p className="p-4 text-sm text-gray-500 dark:text-gray-400">
                이 날짜에는 예약이 없습니다.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {sortedBookings.map((b) => (
                  <li
                    key={b.id}
                    className="flex flex-wrap items-center gap-3 px-4 py-3"
                  >
                    <span className="w-28 shrink-0 text-sm font-medium text-blue-700 dark:text-blue-400">
                      {minToTime(b.startMin)} ~ {minToTime(b.endMin)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-gray-900 dark:text-gray-100">
                      {b.purpose || "용도 미기재"}
                    </span>
                    <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                      {b.createdByName}
                    </span>
                    {deleteControls(b)}
                  </li>
                ))}
              </ul>
            )}

            <form
              onSubmit={handleCreate}
              className="space-y-2 border-t border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800/50"
            >
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  disabled={submitting}
                  aria-label="시작 시간"
                  className={`${inputClass} dark:bg-gray-900`}
                />
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  ~
                </span>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  disabled={submitting}
                  aria-label="종료 시간"
                  className={`${inputClass} dark:bg-gray-900`}
                />
                <input
                  type="text"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  disabled={submitting}
                  placeholder="용도 (선택)"
                  aria-label="용도"
                  className={`min-w-40 flex-1 ${inputClass} dark:bg-gray-900`}
                />
                <select
                  value={repeat}
                  onChange={(e) =>
                    setRepeat(e.target.value as "none" | "weekly")
                  }
                  disabled={submitting}
                  aria-label="반복"
                  className={`${inputClass} dark:bg-gray-900`}
                >
                  <option value="none">반복 안 함</option>
                  <option value="weekly">매주</option>
                </select>
                {repeat === "weekly" && (
                  <select
                    value={repeatCount}
                    onChange={(e) => setRepeatCount(e.target.value)}
                    disabled={submitting}
                    aria-label="반복 횟수"
                    className={`${inputClass} dark:bg-gray-900`}
                  >
                    {[2, 3, 4, 6, 8, 12].map((n) => (
                      <option key={n} value={String(n)}>
                        {n}주
                      </option>
                    ))}
                  </select>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? "예약 중..." : "예약"}
                </button>
              </div>
              {formError && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  {formError}
                </p>
              )}
              {formInfo && (
                <p className="text-sm text-green-700 dark:text-green-400">
                  {formInfo}
                </p>
              )}
            </form>
          </div>

          <section className="mt-8">
            <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
              내 예약
            </h2>
            <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
              {myBookings.length === 0 ? (
                <p className="p-4 text-sm text-gray-500 dark:text-gray-400">
                  예정된 예약이 없습니다.
                </p>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                  {myBookings.map((b) => (
                    <li
                      key={b.id}
                      className="flex flex-wrap items-center gap-3 px-4 py-3"
                    >
                      <span className="shrink-0 text-sm text-gray-500 dark:text-gray-400">
                        {b.date}
                      </span>
                      <span className="w-28 shrink-0 text-sm font-medium text-blue-700 dark:text-blue-400">
                        {minToTime(b.startMin)} ~ {minToTime(b.endMin)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-gray-900 dark:text-gray-100">
                        {b.itemName}
                        {b.purpose && ` · ${b.purpose}`}
                      </span>
                      {deleteControls(b)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default function BookingsPage() {
  return (
    <AuthGuard>
      <BookingsContent />
    </AuthGuard>
  );
}
