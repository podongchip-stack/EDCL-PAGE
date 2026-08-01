"use client";

import { useState } from "react";
import { deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { formatDate, tsToDate } from "@/lib/dates";
import { Task, TASK_STATUS_LABELS, TaskStatus } from "@/types";

const STATUS_BADGE_CLASSES: Record<TaskStatus, string> = {
  todo: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  done: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
};

interface TaskItemProps {
  task: Task;
}

export default function TaskItem({ task }: TaskItemProps) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const due = tsToDate(task.dueDate);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const overdue =
    !!due && task.status !== "done" && due.getTime() < startOfToday.getTime();

  const changeStatus = async (next: TaskStatus) => {
    if (next === task.status) return;
    setSaving(true);
    setError("");
    try {
      await updateDoc(doc(db, "tasks", task.id), { status: next });
    } catch {
      setError("상태 변경에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const saveTitle = async () => {
    const trimmed = editTitle.trim();
    if (!trimmed) {
      setError("작업 제목을 입력하세요.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await updateDoc(doc(db, "tasks", task.id), { title: trimmed });
      setEditing(false);
    } catch {
      setError("제목 수정에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const removeTask = async () => {
    setDeleting(true);
    setError("");
    try {
      await deleteDoc(doc(db, "tasks", task.id));
    } catch {
      setError("작업 삭제에 실패했습니다.");
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  return (
    <li className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-800/50">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={task.status}
          onChange={(e) => changeStatus(e.target.value as TaskStatus)}
          disabled={saving || deleting}
          aria-label="작업 상태"
          className={`cursor-pointer rounded-full px-2 py-0.5 text-xs font-medium disabled:opacity-50 ${STATUS_BADGE_CLASSES[task.status]}`}
        >
          {(Object.keys(TASK_STATUS_LABELS) as TaskStatus[]).map((s) => (
            <option key={s} value={s}>
              {TASK_STATUS_LABELS[s]}
            </option>
          ))}
        </select>

        {editing ? (
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              disabled={saving}
              className="w-full min-w-0 flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
            <button
              type="button"
              onClick={saveTitle}
              disabled={saving}
              className="rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              저장
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setError("");
              }}
              disabled={saving}
              className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              취소
            </button>
          </span>
        ) : (
          <span
            className={`min-w-0 flex-1 truncate text-sm ${
              task.status === "done"
                ? "text-gray-400 line-through dark:text-gray-500"
                : "text-gray-800 dark:text-gray-200"
            }`}
          >
            {task.title}
          </span>
        )}

        <span className="text-xs text-gray-500 dark:text-gray-400">
          {task.assigneeName ?? "담당자 없음"}
        </span>
        {due && (
          <span
            className={`text-xs ${
              overdue
                ? "font-semibold text-red-600 dark:text-red-400"
                : "text-gray-500 dark:text-gray-400"
            }`}
          >
            {formatDate(due)}
            {overdue && " (지남)"}
          </span>
        )}

        {!editing && (
          <button
            type="button"
            onClick={() => {
              setEditing(true);
              setEditTitle(task.title);
              setConfirmingDelete(false);
              setError("");
            }}
            disabled={deleting}
            className="text-xs text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
          >
            수정
          </button>
        )}
        {confirmingDelete ? (
          <span className="flex items-center gap-1">
            <button
              type="button"
              onClick={removeTask}
              disabled={deleting}
              className="rounded-md bg-red-600 px-2 py-0.5 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
            >
              정말 삭제
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              disabled={deleting}
              className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              취소
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            disabled={deleting}
            className="text-xs text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
          >
            삭제
          </button>
        )}
      </div>
      {error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </li>
  );
}
