import { Rotation } from "@/types";

// 해당 날짜가 속한 주의 시작(일요일) 자정
export function weekStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());
}

function parseDateStr(v: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

// 이번 회차 담당자 인덱스. anchorDate가 속한 주가 0회차(members[0]).
export function rotationIndex(rotation: Rotation, now: Date): number | null {
  const len = rotation.members.length;
  if (len === 0) return null;
  const anchor = parseDateStr(rotation.anchorDate);
  if (!anchor) return null;
  const interval = Math.max(1, rotation.intervalWeeks);
  const weeks = Math.round(
    (weekStart(now).getTime() - weekStart(anchor).getTime()) /
      (7 * 24 * 60 * 60 * 1000)
  );
  const turn = Math.floor(weeks / interval);
  // 앵커 이전 날짜에서도 음수가 되지 않게 보정
  return ((turn % len) + len) % len;
}

export function currentAssignee(rotation: Rotation, now: Date): string | null {
  const idx = rotationIndex(rotation, now);
  return idx === null ? null : rotation.members[idx];
}

export function nextAssignee(rotation: Rotation, now: Date): string | null {
  const idx = rotationIndex(rotation, now);
  return idx === null
    ? null
    : rotation.members[(idx + 1) % rotation.members.length];
}
