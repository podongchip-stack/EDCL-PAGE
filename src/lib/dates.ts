import { Timestamp } from "firebase/firestore";

export const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

export function tsToDate(ts: Timestamp | null | undefined): Date | null {
  return ts ? ts.toDate() : null;
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// YYYY-MM-DD (input[type=date] 값과 동일한 형식)
export function formatDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// 분(0~1440) → "HH:mm"
export function minToTime(min: number): string {
  return `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`;
}

// "HH:mm" → 분. 형식이 아니면 null
export function timeToMin(v: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(v);
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (h > 23 || mm > 59) return null;
  return h * 60 + mm;
}

// 오늘부터 해당 날짜까지 남은 일수 (오늘이면 0, 지났으면 음수)
export function daysUntil(d: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
