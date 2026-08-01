"use client";

import { LabEvent } from "@/types";
import { eventCategoryStyle } from "@/lib/eventCategories";
import { eventsOnDay } from "@/lib/events";
import { WEEKDAY_LABELS, isSameDay } from "@/lib/dates";

interface WeekGridProps {
  weekStart: Date; // 주 시작(일요일)
  events: LabEvent[];
  onDayClick: (date: Date) => void;
  onEventClick: (event: LabEvent) => void;
}

export default function WeekGrid({
  weekStart,
  events,
  onDayClick,
  onEventClick,
}: WeekGridProps) {
  const today = new Date();
  const days = Array.from(
    { length: 7 },
    (_, i) =>
      new Date(
        weekStart.getFullYear(),
        weekStart.getMonth(),
        weekStart.getDate() + i
      )
  );

  const weekdayColor = (i: number) =>
    i === 0
      ? "text-red-500 dark:text-red-400"
      : i === 6
        ? "text-blue-600 dark:text-blue-400"
        : "text-gray-600 dark:text-gray-400";

  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-800">
      {days.map((day, i) => {
        const isToday = isSameDay(day, today);
        const dayEvents = eventsOnDay(events, day);
        return (
          <div
            key={day.getTime()}
            onClick={() => onDayClick(day)}
            className="flex cursor-pointer gap-3 px-4 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/60"
          >
            <div className="w-14 shrink-0 text-center">
              <p className={`text-xs font-medium ${weekdayColor(i)}`}>
                {WEEKDAY_LABELS[i]}
              </p>
              <p
                className={`mx-auto mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-base ${
                  isToday
                    ? "bg-blue-600 font-bold text-white"
                    : "text-gray-800 dark:text-gray-200"
                }`}
              >
                {day.getDate()}
              </p>
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              {dayEvents.length === 0 ? (
                <p className="py-1.5 text-xs text-gray-400 dark:text-gray-600">
                  일정 없음
                </p>
              ) : (
                dayEvents.map((ev) => (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(ev);
                    }}
                    className={`block w-full truncate rounded px-2 py-1 text-left text-xs transition-colors ${
                      eventCategoryStyle(ev).chip
                    }`}
                    title={ev.title}
                  >
                    {ev.title}
                  </button>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
