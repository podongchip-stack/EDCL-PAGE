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

// Firestore: events/{eventId}
// 일정은 날짜 단위로만 관리한다 (start: 시작일 00:00, end: 종료일 23:59:59)
export interface LabEvent {
  id: string;
  title: string;
  description: string;
  start: Timestamp;
  end: Timestamp;
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
