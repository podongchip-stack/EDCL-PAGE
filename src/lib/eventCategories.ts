import { EVENT_CATEGORY_LABELS, EventCategory, LabEvent } from "@/types";

interface CategoryStyle {
  label: string;
  // 달력 칩 (진한 배경 + 흰 글씨)
  chip: string;
  // 목록용 색 점
  dot: string;
  // 상세보기 배지 (연한 배경 + 진한 글씨)
  badge: string;
}

export const EVENT_CATEGORY_STYLES: Record<EventCategory, CategoryStyle> = {
  seminar: {
    label: EVENT_CATEGORY_LABELS.seminar,
    chip: "bg-blue-600 text-white hover:bg-blue-700",
    dot: "bg-blue-500",
    badge: "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
  },
  meeting: {
    label: EVENT_CATEGORY_LABELS.meeting,
    chip: "bg-emerald-600 text-white hover:bg-emerald-700",
    dot: "bg-emerald-500",
    badge:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  },
  deadline: {
    label: EVENT_CATEGORY_LABELS.deadline,
    chip: "bg-red-600 text-white hover:bg-red-700",
    dot: "bg-red-500",
    badge: "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300",
  },
  vacation: {
    label: EVENT_CATEGORY_LABELS.vacation,
    chip: "bg-amber-600 text-white hover:bg-amber-700",
    dot: "bg-amber-500",
    badge: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
  },
  etc: {
    label: EVENT_CATEGORY_LABELS.etc,
    chip: "bg-gray-600 text-white hover:bg-gray-700",
    dot: "bg-gray-500",
    badge: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  },
};

export const EVENT_CATEGORY_ORDER: EventCategory[] = [
  "seminar",
  "meeting",
  "deadline",
  "vacation",
  "etc",
];

// 초기 데이터에는 category 필드가 없으므로 "etc"로 취급한다
export function eventCategory(ev: LabEvent): EventCategory {
  return ev.category && ev.category in EVENT_CATEGORY_STYLES
    ? ev.category
    : "etc";
}

export function eventCategoryStyle(ev: LabEvent): CategoryStyle {
  return EVENT_CATEGORY_STYLES[eventCategory(ev)];
}
