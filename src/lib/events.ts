import { LabEvent } from "@/types";
import { tsToDate } from "./dates";

// 해당 날짜(시작~종료 구간에 걸친)의 일정을 시작일순으로 반환
export function eventsOnDay(events: LabEvent[], day: Date): LabEvent[] {
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
    .sort((a, b) => a.start.toMillis() - b.start.toMillis());
}
