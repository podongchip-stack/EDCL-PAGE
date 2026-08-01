"use client";

import { FormEvent, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Project, Task, TaskStatus, UserProfile } from "@/types";
import KanbanBoard from "@/components/projects/KanbanBoard";
import TaskItem from "@/components/projects/TaskItem";

const STATUS_ORDER: Record<TaskStatus, number> = {
  todo: 0,
  in_progress: 1,
  done: 2,
};

function taskMillis(t: Task): number {
  return t.createdAt ? t.createdAt.toMillis() : Number.MAX_SAFE_INTEGER;
}

interface ProjectCardProps {
  project: Project;
  tasks: Task[];
  approvedUsers: UserProfile[];
  currentUid: string;
  isAdmin: boolean;
}

export default function ProjectCard({
  project,
  tasks,
  approvedUsers,
  currentUid,
  isAdmin,
}: ProjectCardProps) {
  const [taskView, setTaskView] = useState<"list" | "board">("list");
  const [showAddForm, setShowAddForm] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [assigneeUid, setAssigneeUid] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState("");

  const [archiving, setArchiving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState("");

  const canManage = isAdmin || project.createdBy === currentUid;

  const sortedTasks = [...tasks].sort((a, b) => {
    const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (byStatus !== 0) return byStatus;
    return taskMillis(a) - taskMillis(b);
  });

  const totalCount = tasks.length;
  const doneCount = tasks.filter((t) => t.status === "done").length;
  const percent =
    totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  const handleAddTask = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = taskTitle.trim();
    if (!trimmed) {
      setAddError("작업 제목을 입력하세요.");
      return;
    }
    const assignee =
      approvedUsers.find((u) => u.uid === assigneeUid) ?? null;
    let dueTimestamp: Timestamp | null = null;
    if (dueDate) {
      const [y, m, d] = dueDate.split("-").map(Number);
      dueTimestamp = Timestamp.fromDate(new Date(y, m - 1, d));
    }
    setAddSubmitting(true);
    setAddError("");
    try {
      await addDoc(collection(db, "tasks"), {
        projectId: project.id,
        title: trimmed,
        status: "todo",
        assigneeUid: assignee ? assignee.uid : null,
        assigneeName: assignee ? assignee.name : null,
        dueDate: dueTimestamp,
        createdBy: currentUid,
        createdAt: serverTimestamp(),
      });
      setTaskTitle("");
      setAssigneeUid("");
      setDueDate("");
      setShowAddForm(false);
    } catch {
      setAddError("작업 추가에 실패했습니다. 잠시 후 다시 시도하세요.");
    } finally {
      setAddSubmitting(false);
    }
  };

  const toggleArchive = async () => {
    setArchiving(true);
    setActionError("");
    try {
      await updateDoc(doc(db, "projects", project.id), {
        status: project.status === "active" ? "archived" : "active",
      });
    } catch {
      setActionError(
        project.status === "active"
          ? "프로젝트 보관에 실패했습니다."
          : "프로젝트 복원에 실패했습니다."
      );
    } finally {
      setArchiving(false);
    }
  };

  // 즉시 삭제하지 않고 휴지통(status: deleted)으로 보낸다.
  // 복원·영구 삭제는 프로젝트 페이지의 휴지통 섹션에서 처리한다.
  const moveToTrash = async () => {
    setDeleting(true);
    setActionError("");
    try {
      await updateDoc(doc(db, "projects", project.id), {
        status: "deleted",
        deletedAt: serverTimestamp(),
      });
    } catch {
      setActionError("휴지통 이동에 실패했습니다.");
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {project.name}
            </h2>
            {project.status === "archived" && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                보관됨
              </span>
            )}
          </div>
          {project.description && (
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {project.description}
            </p>
          )}
        </div>

        {canManage && (
          <div className="flex shrink-0 items-center gap-2">
            {confirmingDelete ? (
              <>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  작업 {totalCount}개와 함께 휴지통으로 이동합니다
                </span>
                <button
                  type="button"
                  onClick={moveToTrash}
                  disabled={deleting}
                  className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                >
                  휴지통으로
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={deleting}
                  className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  취소
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={toggleArchive}
                  disabled={archiving}
                  className="rounded-md border border-gray-300 px-2.5 py-1 text-xs text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  {project.status === "active" ? "보관" : "복원"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  className="rounded-md border border-red-200 px-2.5 py-1 text-xs text-red-600 transition-colors hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
                >
                  삭제
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {actionError && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">
          {actionError}
        </p>
      )}

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>
            완료 {doneCount} / 전체 {totalCount}
          </span>
          <span>{percent}%</span>
        </div>
        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
          <div
            className="h-full rounded-full bg-blue-600 transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {sortedTasks.length > 0 && (
        <div className="mt-4 flex items-center gap-1">
          {(
            [
              { value: "list", label: "목록" },
              { value: "board", label: "보드" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTaskView(opt.value)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                taskView === opt.value
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                  : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {sortedTasks.length === 0 ? (
        <p className="mt-4 text-sm text-gray-400 dark:text-gray-500">
          등록된 작업이 없습니다.
        </p>
      ) : taskView === "board" ? (
        <KanbanBoard tasks={sortedTasks} />
      ) : (
        <ul className="mt-3 space-y-2">
          {sortedTasks.map((t) => (
            <TaskItem key={t.id} task={t} approvedUsers={approvedUsers} />
          ))}
        </ul>
      )}

      {showAddForm ? (
        <form
          onSubmit={handleAddTask}
          className="mt-3 space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50"
        >
          <input
            type="text"
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            placeholder="작업 제목 (필수)"
            disabled={addSubmitting}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500"
          />
          <div className="flex flex-wrap gap-2">
            <select
              value={assigneeUid}
              onChange={(e) => setAssigneeUid(e.target.value)}
              disabled={addSubmitting}
              aria-label="담당자"
              className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            >
              <option value="">담당자 없음</option>
              {approvedUsers.map((u) => (
                <option key={u.uid} value={u.uid}>
                  {u.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              disabled={addSubmitting}
              aria-label="마감일"
              className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>
          {addError && (
            <p className="text-xs text-red-600 dark:text-red-400">{addError}</p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={addSubmitting}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {addSubmitting ? "추가 중..." : "추가"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setAddError("");
              }}
              disabled={addSubmitting}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              취소
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="mt-3 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          + 작업 추가
        </button>
      )}
    </section>
  );
}
