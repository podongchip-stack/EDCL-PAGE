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

// HH:mm
export function formatTime(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// YYYY-MM-DD HH:mm
export function formatDateTime(d: Date): string {
  return `${formatDate(d)} ${formatTime(d)}`;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
