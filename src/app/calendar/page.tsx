"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import AuthGuard from "@/components/AuthGuard";
import MonthGrid from "@/components/calendar/MonthGrid";
import EventModal from "@/components/calendar/EventModal";
import { db } from "@/lib/firebase";
import { LabEvent } from "@/types";
import { formatDate, formatDateTime, tsToDate } from "@/lib/dates";

type ModalState =
  | { type: "create"; date: Date }
  | { type: "view"; eventId: string }
  | null;

function CalendarContent() {
  const [viewDate, setViewDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [events, setEvents] = useState<LabEvent[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rawModal, setModal] = useState<ModalState>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "events"),
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
  }, []);

  // 상세 보기 중인 일정이 (다른 사용자에 의해) 삭제되면 모달을 닫힌 것으로 취급한다
  const modal =
    rawModal?.type === "view" &&
    !events.some((e) => e.id === rawModal.eventId)
      ? null
      : rawModal;

  const selectedEvent =
    modal?.type === "view"
      ? (events.find((e) => e.id === modal.eventId) ?? null)
      : null;

  const now = new Date();
  const upcoming = events
    .filter((ev) => {
      const start = tsToDate(ev.start);
      return !!start && start >= now;
    })
    .sort((a, b) => a.start.toMillis() - b.start.toMillis());

  const goPrev = () =>
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const goNext = () =>
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  const goToday = () => {
    const n = new Date();
    setViewDate(new Date(n.getFullYear(), n.getMonth(), 1));
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold">일정표</h1>

      {loadError && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
          {loadError}
        </p>
      )}

      <div className="mt-6 rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="text-lg font-semibold text-gray-900">
            {viewDate.getFullYear()}년 {viewDate.getMonth() + 1}월
          </h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={goPrev}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100"
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
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100"
            >
              다음
            </button>
          </div>
        </div>
        <MonthGrid
          year={viewDate.getFullYear()}
          month={viewDate.getMonth()}
          events={events}
          onDayClick={(date) => setModal({ type: "create", date })}
          onEventClick={(ev) => setModal({ type: "view", eventId: ev.id })}
        />
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">
          다가오는 일정
        </h2>
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
          {upcoming.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">다가오는 일정이 없습니다.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {upcoming.map((ev) => {
                const start = tsToDate(ev.start);
                if (!start) return null;
                return (
                  <li key={ev.id}>
                    <button
                      type="button"
                      onClick={() =>
                        setModal({ type: "view", eventId: ev.id })
                      }
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50"
                    >
                      <span className="w-40 shrink-0 text-sm text-gray-500">
                        {ev.allDay
                          ? `${formatDate(start)} 종일`
                          : formatDateTime(start)}
                      </span>
                      <span className="flex-1 truncate text-sm font-medium text-gray-900">
                        {ev.title}
                      </span>
                      <span className="shrink-0 text-xs text-gray-500">
                        {ev.createdByName}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

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
      <CalendarContent />
    </AuthGuard>
  );
}
