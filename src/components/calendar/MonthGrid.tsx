"use client";

import { LabEvent } from "@/types";
import { WEEKDAY_LABELS, formatTime, isSameDay, tsToDate } from "@/lib/dates";

const MAX_CHIPS = 3;

interface MonthGridProps {
  year: number;
  month: number; // 0-based
  events: LabEvent[];
  onDayClick: (date: Date) => void;
  onEventClick: (event: LabEvent) => void;
}

// 해당 날짜(시작~종료 구간에 걸친)의 일정을 종일 우선, 시작시각순으로 반환
function eventsForDay(events: LabEvent[], day: Date): LabEvent[] {
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const dayEnd = new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    23,
    59,
    59,
    999
  );
  return events
    .filter((ev) => {
      const start = tsToDate(ev.start);
      const end = tsToDate(ev.end);
      if (!start || !end) return false;
      return start <= dayEnd && end >= dayStart;
    })
    .sort((a, b) => {
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      return a.start.toMillis() - b.start.toMillis();
    });
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
    i === 0 ? "text-red-500" : i === 6 ? "text-blue-600" : "text-gray-600";

  return (
    <div>
      <div className="grid grid-cols-7 border-b border-gray-200">
        {WEEKDAY_LABELS.map((label, i) => (
          <div
            key={label}
            className={`py-2 text-center text-sm font-medium ${weekdayColor(i)}`}
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-gray-100">
        {cells.map((day) => {
          const inMonth = day.getMonth() === month;
          const isToday = isSameDay(day, today);
          const dayEvents = eventsForDay(events, day);
          const visible = dayEvents.slice(0, MAX_CHIPS);
          const overflow = dayEvents.length - visible.length;

          return (
            <div
              key={day.getTime()}
              onClick={() => onDayClick(day)}
              className={`min-h-24 cursor-pointer p-1 transition-colors hover:bg-gray-50 ${
                inMonth ? "bg-white" : "bg-gray-50"
              } ${isToday ? "bg-blue-50 ring-2 ring-inset ring-blue-500" : ""}`}
            >
              <span
                className={`mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                  isToday
                    ? "bg-blue-600 font-bold text-white"
                    : inMonth
                      ? "text-gray-700"
                      : "text-gray-400"
                }`}
              >
                {day.getDate()}
              </span>
              <div className="space-y-0.5">
                {visible.map((ev) => {
                  const start = tsToDate(ev.start);
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick(ev);
                      }}
                      className={`block w-full truncate rounded px-1 py-0.5 text-left text-xs transition-colors ${
                        ev.allDay
                          ? "bg-blue-600 text-white hover:bg-blue-700"
                          : "bg-blue-50 text-blue-700 hover:bg-blue-100"
                      } ${!inMonth ? "opacity-60" : ""}`}
                      title={ev.title}
                    >
                      {!ev.allDay && start && (
                        <span className="mr-1 font-medium">
                          {formatTime(start)}
                        </span>
                      )}
                      {ev.title}
                    </button>
                  );
                })}
                {overflow > 0 && (
                  <div className="px-1 text-xs text-gray-500">
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
