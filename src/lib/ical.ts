import { EVENT_CATEGORY_LABELS, LabEvent } from "@/types";
import { eventCategory } from "./eventCategories";
import { pad2, tsToDate } from "./dates";

function icsDate(d: Date): string {
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
}

function icsStamp(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}` +
    `T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`
  );
}

function escapeText(v: string): string {
  return v
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

// 날짜 단위 일정을 iCalendar(.ics) 문자열로 변환한다.
// DTEND는 스펙상 exclusive이므로 종료일 다음 날을 쓴다.
export function eventsToIcs(events: LabEvent[]): string {
  const stamp = icsStamp(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//EDCL LAB//Calendar//KO",
    "CALSCALE:GREGORIAN",
    "X-WR-CALNAME:EDCL LAB 일정",
  ];
  for (const ev of events) {
    const s = tsToDate(ev.start);
    const e = tsToDate(ev.end);
    if (!s || !e) continue;
    const endExclusive = new Date(e.getFullYear(), e.getMonth(), e.getDate() + 1);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${ev.id}@edcl-lab`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${icsDate(s)}`,
      `DTEND;VALUE=DATE:${icsDate(endExclusive)}`,
      `SUMMARY:${escapeText(ev.title)}`,
      `CATEGORIES:${escapeText(EVENT_CATEGORY_LABELS[eventCategory(ev)])}`
    );
    if (ev.description) {
      lines.push(`DESCRIPTION:${escapeText(ev.description)}`);
    }
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadIcs(filename: string, ics: string) {
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
