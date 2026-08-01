import { Timestamp } from "firebase/firestore";

export type UserRole = "admin" | "member";
export type UserStatus = "pending" | "approved";

// Firestore: users/{uid}
export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Timestamp | null;
}

export type EventCategory =
  | "seminar"
  | "meeting"
  | "deadline"
  | "vacation"
  | "etc";

export const EVENT_CATEGORY_LABELS: Record<EventCategory, string> = {
  seminar: "세미나",
  meeting: "미팅",
  deadline: "마감",
  vacation: "휴가",
  etc: "기타",
};

// Firestore: events/{eventId}
// 일정은 날짜 단위로만 관리한다 (start: 시작일 00:00, end: 종료일 23:59:59)
export interface LabEvent {
  id: string;
  title: string;
  description: string;
  category?: EventCategory; // 초기 데이터에는 없을 수 있다 (없으면 "etc"로 취급)
  start: Timestamp;
  end: Timestamp;
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp | null;
}

// Firestore: notices/{noticeId} — 관리자만 작성하는 공지사항
export interface Notice {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp | null;
}

// Firestore: resources/{resourceId} — 자료실 링크
export interface ResourceLink {
  id: string;
  title: string;
  url: string;
  description: string;
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp | null;
}

export type ProjectStatus = "active" | "archived" | "deleted";

// Firestore: projects/{projectId}
// status "deleted"는 휴지통 상태 — 복원 전까지 목록에서 숨기고 영구 삭제로만 제거한다
export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  deletedAt?: Timestamp | null;
  createdBy: string;
  createdAt: Timestamp | null;
}

export type TaskStatus = "todo" | "in_progress" | "done";

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "할 일",
  in_progress: "진행중",
  done: "완료",
};

// Firestore: tasks/{taskId}
export interface Task {
  id: string;
  projectId: string;
  title: string;
  status: TaskStatus;
  assigneeUid: string | null;
  assigneeName: string | null;
  dueDate: Timestamp | null;
  createdBy: string;
  createdAt: Timestamp | null;
}

// Firestore: publications/{pubId} — 공개 논문/출판물 목록
export interface Publication {
  id: string;
  title: string;
  authors: string;
  venue: string;
  year: number;
  link: string;
  createdBy: string;
  createdAt: Timestamp | null;
}

// Firestore: publicProfiles/{uid} — 공개 구성원 프로필 (본인이 설정에서 관리)
export interface PublicProfile {
  uid: string;
  name: string;
  position: string; // 예: 석사과정, 박사과정, 지도교수
  interests: string; // 연구 분야
  visible: boolean;
  updatedAt: Timestamp | null;
}

// Firestore: siteContent/labInfo — 공개 랜딩 페이지 문구 (관리자 편집)
// 비어 있는 필드는 코드에 정의된 기본 문구(publicStrings)로 대체 표시된다
export interface LabInfo {
  intro: string;
  introEn?: string; // 영문 소개 (없으면 EN 모드에서도 국문 intro 표시)
  research?: string; // 연구 소개 본문 (여러 문단)
  researchEn?: string;
  topics?: string; // 연구 키워드 (쉼표로 구분 → 칩으로 표시)
  topicsEn?: string;
  professor: string;
  contact: string;
}

// Firestore: bookableItems/{itemId} — 예약 가능한 회의실/장비 (관리자 관리)
export interface BookableItem {
  id: string;
  name: string;
  description: string;
  createdAt: Timestamp | null;
}

// Firestore: bookings/{bookingId} — 시간대 예약
// date는 "YYYY-MM-DD", startMin/endMin은 0~1440 분 단위 (예: 09:30 = 570)
export interface Booking {
  id: string;
  itemId: string;
  itemName: string;
  date: string;
  startMin: number;
  endMin: number;
  purpose: string;
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp | null;
}

// Firestore: rotations/{rotationId} — 세미나 발표/당번 순번 (관리자 관리)
// anchorDate("YYYY-MM-DD")가 속한 주가 members[0] 담당, 이후 intervalWeeks 주기로 순환
export interface Rotation {
  id: string;
  title: string;
  members: string[];
  anchorDate: string;
  intervalWeeks: number;
  createdAt: Timestamp | null;
}
