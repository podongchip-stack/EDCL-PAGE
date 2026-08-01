"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import AuthGuard from "@/components/AuthGuard";
import MonthGrid from "@/components/calendar/MonthGrid";
import WeekGrid from "@/components/calendar/WeekGrid";
import EventModal from "@/components/calendar/EventModal";
import { db } from "@/lib/firebase";
import { LabEvent } from "@/types";
import {
  EVENT_CATEGORY_ORDER,
  EVENT_CATEGORY_STYLES,
  eventCategoryStyle,
} from "@/lib/eventCategories";
import { downloadIcs, eventsToIcs } from "@/lib/ical";
import { weekStart } from "@/lib/rotations";
import { formatDate, isSameDay, tsToDate } from "@/lib/dates";

type ModalState =
  | { type: "create"; date: Date }
  | { type: "view"; eventId: string }
  | null;

// 표시 범위보다 최대 60일 앞서 시작한 장기 일정까지 구독 범위에 포함한다
const LOOKBACK_DAYS = 60;

function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

function CalendarContent() {
  const searchParams = useSearchParams();
  const deepLinkEventId = searchParams.get("event");
  const [view, setView] = useState<"month" | "week">("month");
  // month 뷰에서는 그 달 1일, week 뷰에서는 주 시작(일요일)을 가리킨다
  const [viewDate, setViewDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [events, setEvents] = useState<LabEvent[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<LabEvent[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rawModal, setModal] = useState<ModalState>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [deepLinkEvent, setDeepLinkEvent] = useState<LabEvent | null>(null);
  // 같은 페이지에서 연속으로 다른 일정을 검색해도 동작하도록 id 단위로 처리를 기억한다
  const [deepLinkHandledId, setDeepLinkHandledId] = useState<string | null>(
    null
  );

  // 검색 결과에서 ?event=<id>로 진입하면 해당 일정의 달로 이동해 상세를 연다
  useEffect(() => {
    if (!deepLinkEventId || deepLinkHandledId === deepLinkEventId) return;
    setDeepLinkHandledId(deepLinkEventId);
    getDoc(doc(db, "events", deepLinkEventId))
      .then((snap) => {
        if (!snap.exists()) return;
        const ev = { id: snap.id, ...snap.data() } as LabEvent;
        setDeepLinkEvent(ev);
        const start = tsToDate(ev.start);
        if (start) {
          setView("month");
          setViewDate(new Date(start.getFullYear(), start.getMonth(), 1));
        }
        setModal({ type: "view", eventId: ev.id });
      })
      .catch(() => {
        // 삭제됐거나 접근 불가 — 달력만 보여준다
      });
  }, [deepLinkEventId, deepLinkHandledId]);

  // 표시 범위 (rangeEnd는 exclusive)
  const rangeStart =
    view === "month"
      ? (() => {
          const first = new Date(
            viewDate.getFullYear(),
            viewDate.getMonth(),
            1
          );
          return addDays(first, -first.getDay());
        })()
      : viewDate;
  const rangeEnd = addDays(rangeStart, view === "month" ? 42 : 7);
  const rangeStartMs = rangeStart.getTime();
  const rangeEndMs = rangeEnd.getTime();

  // 표시 범위 일정만 구독한다 (데이터가 쌓여도 달력이 느려지지 않도록)
  useEffect(() => {
    const windowStart = new Date(rangeStartMs - LOOKBACK_DAYS * 86400000);
    const q = query(
      collection(db, "events"),
      where("start", ">=", Timestamp.fromDate(windowStart)),
      where("start", "<", Timestamp.fromDate(new Date(rangeEndMs)))
    );
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setEvents(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as LabEvent)
        );
        setLoadError(null);
      },
      () => {
        setLoadError("일정을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
      }
    );
    return unsubscribe;
  }, [rangeStartMs, rangeEndMs]);

  // 다가오는 일정: 오늘 이후 종료되는 일정 (표시 범위와 무관하게 별도 구독)
  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const q = query(
      collection(db, "events"),
      where("end", ">=", Timestamp.fromDate(today))
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setUpcomingEvents(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }) as LabEvent)
      );
    });
    return unsubscribe;
  }, []);

  // 딥링크 일정이 라이브 구독에 나타나면 임시 사본을 폐기한다
  // (삭제·수정이 즉시 반영되도록 — 사본이 남으면 유령 일정이 된다)
  useEffect(() => {
    if (!deepLinkEvent) return;
    const inLive =
      events.some((e) => e.id === deepLinkEvent.id) ||
      upcomingEvents.some((e) => e.id === deepLinkEvent.id);
    if (inLive) setDeepLinkEvent(null);
  }, [events, upcomingEvents, deepLinkEvent]);

  // 두 구독을 합친다 — 60일보다 앞서 시작한 진행 중 장기 일정도
  // upcoming 구독(end>=오늘)에 잡히므로, 그리드에도 병합 결과를 넘긴다
  const eventById = new Map<string, LabEvent>();
  if (deepLinkEvent) eventById.set(deepLinkEvent.id, deepLinkEvent);
  for (const ev of events) eventById.set(ev.id, ev);
  for (const ev of upcomingEvents) eventById.set(ev.id, ev);
  const mergedEvents = Array.from(eventById.values());

  // 상세 보기 중인 일정이 (다른 사용자에 의해) 삭제되면 모달을 닫힌 것으로 취급한다
  const modal =
    rawModal?.type === "view" && !eventById.has(rawModal.eventId)
      ? null
      : rawModal;

  const selectedEvent =
    modal?.type === "view" ? (eventById.get(modal.eventId) ?? null) : null;

  const upcoming = [...upcomingEvents].sort(
    (a, b) => a.start.toMillis() - b.start.toMillis()
  );

  const goPrev = () =>
    setViewDate((d) =>
      view === "month"
        ? new Date(d.getFullYear(), d.getMonth() - 1, 1)
        : addDays(d, -7)
    );
  const goNext = () =>
    setViewDate((d) =>
      view === "month"
        ? new Date(d.getFullYear(), d.getMonth() + 1, 1)
        : addDays(d, 7)
    );
  const goToday = () => {
    const now = new Date();
    setViewDate(
      view === "month"
        ? new Date(now.getFullYear(), now.getMonth(), 1)
        : weekStart(now)
    );
  };

  const switchView = (next: "month" | "week") => {
    if (next === view) return;
    const now = new Date();
    if (next === "week") {
      // 보고 있던 달이 이번 달이면 이번 주부터, 아니면 그 달 첫 주부터
      const sameMonth =
        viewDate.getFullYear() === now.getFullYear() &&
        viewDate.getMonth() === now.getMonth();
      setViewDate(sameMonth ? weekStart(now) : weekStart(viewDate));
    } else {
      // 주→월: 주 시작(일요일)이 이전 달일 수 있으므로,
      // 오늘이 이 주에 속하면 오늘, 아니면 주의 마지막 날 기준으로 달을 정한다
      const inThisWeek = now >= viewDate && now < addDays(viewDate, 7);
      const base = inThisWeek ? now : addDays(viewDate, 6);
      setViewDate(new Date(base.getFullYear(), base.getMonth(), 1));
    }
    setView(next);
  };

  const exportIcs = async () => {
    if (exporting) return;
    setExporting(true);
    setExportError(null);
    try {
      const snap = await getDocs(collection(db, "events"));
      const all = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as LabEvent
      );
      downloadIcs("edcl-lab-calendar.ics", eventsToIcs(all));
    } catch {
      setExportError("iCal 내보내기에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setExporting(false);
    }
  };

  const title =
    view === "month"
      ? `${viewDate.getFullYear()}년 ${viewDate.getMonth() + 1}월`
      : `${formatDate(rangeStart)} ~ ${formatDate(addDays(rangeStart, 6))}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">일정표</h1>
        <button
          type="button"
          onClick={exportIcs}
          disabled={exporting}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          {exporting ? "내보내는 중..." : "iCal 내보내기"}
        </button>
      </div>

      {loadError && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/50 dark:text-red-400">
          {loadError}
        </p>
      )}
      {exportError && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/50 dark:text-red-400">
          {exportError}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-4 py-3 dark:border-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {title}
            </h2>
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-md border border-gray-300 p-0.5 dark:border-gray-700">
                {(
                  [
                    { value: "month", label: "월" },
                    { value: "week", label: "주" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => switchView(opt.value)}
                    className={`rounded px-2.5 py-1 text-sm font-medium transition-colors ${
                      view === opt.value
                        ? "bg-blue-600 text-white"
                        : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={goPrev}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  이전
                </button>
                <button
                  type="button"
                  onClick={goToday}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                >
                  오늘
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  다음
                </button>
              </div>
            </div>
          </div>
          {view === "month" ? (
            <MonthGrid
              year={viewDate.getFullYear()}
              month={viewDate.getMonth()}
              events={mergedEvents}
              onDayClick={(date) => setModal({ type: "create", date })}
              onEventClick={(ev) => setModal({ type: "view", eventId: ev.id })}
            />
          ) : (
            <WeekGrid
              weekStart={viewDate}
              events={mergedEvents}
              onDayClick={(date) => setModal({ type: "create", date })}
              onEventClick={(ev) => setModal({ type: "view", eventId: ev.id })}
            />
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-gray-200 px-4 py-2 dark:border-gray-800">
            {EVENT_CATEGORY_ORDER.map((c) => (
              <span
                key={c}
                className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400"
              >
                <span
                  className={`h-2 w-2 rounded-full ${EVENT_CATEGORY_STYLES[c].dot}`}
                />
                {EVENT_CATEGORY_STYLES[c].label}
              </span>
            ))}
          </div>
        </div>

        <aside className="w-full shrink-0 lg:w-72">
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="border-b border-gray-200 px-4 py-3 text-lg font-semibold text-gray-900 dark:border-gray-800 dark:text-gray-100">
              다가오는 일정
            </h2>
            {upcoming.length === 0 ? (
              <p className="p-4 text-sm text-gray-500 dark:text-gray-400">
                다가오는 일정이 없습니다.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {upcoming.map((ev) => {
                  const start = tsToDate(ev.start);
                  const end = tsToDate(ev.end);
                  if (!start || !end) return null;
                  return (
                    <li key={ev.id}>
                      <button
                        type="button"
                        onClick={() =>
                          setModal({ type: "view", eventId: ev.id })
                        }
                        className="w-full px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/60"
                      >
                        <p className="flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${eventCategoryStyle(ev).dot}`}
                          />
                          {isSameDay(start, end)
                            ? formatDate(start)
                            : `${formatDate(start)} ~ ${formatDate(end)}`}
                        </p>
                        <p className="mt-0.5 truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                          {ev.title}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                          {ev.createdByName}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>
      </div>

      {modal?.type === "create" && (
        <EventModal
          event={null}
          defaultDate={modal.date}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "view" && selectedEvent && (
        <EventModal
          event={selectedEvent}
          defaultDate={null}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

export default function CalendarPage() {
  return (
    <AuthGuard>
      {/* useSearchParams 사용 컴포넌트는 Suspense 경계가 필요하다 */}
      <Suspense fallback={null}>
        <CalendarContent />
      </Suspense>
    </AuthGuard>
  );
}
