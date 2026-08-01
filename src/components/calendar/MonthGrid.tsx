"use client";

import { LabEvent } from "@/types";
import { eventCategoryStyle } from "@/lib/eventCategories";
import { eventsOnDay } from "@/lib/events";
import { WEEKDAY_LABELS, isSameDay } from "@/lib/dates";

const MAX_CHIPS = 3;

interface MonthGridProps {
  year: number;
  month: number; // 0-based
  events: LabEvent[];
  onDayClick: (date: Date) => void;
  onEventClick: (event: LabEvent) => void;
}

export default function MonthGrid({
  year,
  month,
  events,
  onDayClick,
  onEventClick,
}: MonthGridProps) {
  const firstOfMonth = new Date(year, month, 1);
  const gridStart = new Date(year, month, 1 - firstOfMonth.getDay());
  const today = new Date();

  const cells: Date[] = Array.from(
    { length: 42 },
    (_, i) =>
      new Date(
        gridStart.getFullYear(),
        gridStart.getMonth(),
        gridStart.getDate() + i
      )
  );

  const weekdayColor = (i: number) =>
    i === 0
      ? "text-red-500 dark:text-red-400"
      : i === 6
        ? "text-blue-600 dark:text-blue-400"
        : "text-gray-600 dark:text-gray-400";

  return (
    <div>
      <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-800">
        {WEEKDAY_LABELS.map((label, i) => (
          <div
            key={label}
            className={`py-2 text-center text-sm font-medium ${weekdayColor(i)}`}
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-gray-100 dark:bg-gray-800">
        {cells.map((day) => {
          const inMonth = day.getMonth() === month;
          const isToday = isSameDay(day, today);
          const dayEvents = eventsOnDay(events, day);
          const visible = dayEvents.slice(0, MAX_CHIPS);
          const overflow = dayEvents.length - visible.length;

          return (
            <div
              key={day.getTime()}
              onClick={() => onDayClick(day)}
              className={`min-h-24 cursor-pointer p-1 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/70 ${
                inMonth
                  ? "bg-white dark:bg-gray-900"
                  : "bg-gray-50 dark:bg-gray-950"
              } ${
                isToday
                  ? "bg-blue-50 ring-2 ring-inset ring-blue-500 dark:bg-blue-950/40"
                  : ""
              }`}
            >
              <span
                className={`mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                  isToday
                    ? "bg-blue-600 font-bold text-white"
                    : inMonth
                      ? "text-gray-700 dark:text-gray-300"
                      : "text-gray-400 dark:text-gray-600"
                }`}
              >
                {day.getDate()}
              </span>
              <div className="space-y-0.5">
                {visible.map((ev) => (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(ev);
                    }}
                    className={`block w-full truncate rounded px-1 py-0.5 text-left text-xs transition-colors ${
                      eventCategoryStyle(ev).chip
                    } ${!inMonth ? "opacity-60" : ""}`}
                    title={ev.title}
                  >
                    {ev.title}
                  </button>
                ))}
                {overflow > 0 && (
                  <div className="px-1 text-xs text-gray-500 dark:text-gray-400">
                    +{overflow}개
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
