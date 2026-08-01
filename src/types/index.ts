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

export type ProjectStatus = "active" | "archived";

// Firestore: projects/{projectId}
export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
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
