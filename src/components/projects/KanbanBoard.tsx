"use client";

import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Task, TASK_STATUS_LABELS, TaskStatus } from "@/types";
import { formatDate, tsToDate } from "@/lib/dates";

const COLUMNS: TaskStatus[] = ["todo", "in_progress", "done"];

const COLUMN_DOT: Record<TaskStatus, string> = {
  todo: "bg-gray-400",
  in_progress: "bg-blue-500",
  done: "bg-green-500",
};

interface KanbanBoardProps {
  tasks: Task[];
}

// 드래그앤드롭(데스크톱) + 카드 내 상태 선택(터치 환경 폴백)으로 상태를 바꾼다.
// 작업 내용 수정·삭제는 목록 보기에서 한다.
export default function KanbanBoard({ tasks }: KanbanBoardProps) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null);
  const [error, setError] = useState("");

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const move = async (taskId: string, next: TaskStatus) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === next) return;
    setError("");
    try {
      await updateDoc(doc(db, "tasks", taskId), { status: next });
    } catch {
      setError("상태 변경에 실패했습니다. 잠시 후 다시 시도하세요.");
    }
  };

  return (
    <div className="mt-3">
      {error && (
        <p className="mb-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col);
          return (
            <div
              key={col}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(col);
              }}
              onDragLeave={() =>
                setDragOver((prev) => (prev === col ? null : prev))
              }
              onDrop={(e) => {
                e.preventDefault();
                if (dragId) move(dragId, col);
                setDragId(null);
                setDragOver(null);
              }}
              className={`min-h-28 rounded-md border p-2 transition-colors ${
                dragOver === col
                  ? "border-blue-400 bg-blue-50/60 dark:border-blue-700 dark:bg-blue-950/30"
                  : "border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/40"
              }`}
            >
              <p className="flex items-center gap-1.5 px-1 text-xs font-semibold text-gray-700 dark:text-gray-300">
                <span className={`h-2 w-2 rounded-full ${COLUMN_DOT[col]}`} />
                {TASK_STATUS_LABELS[col]}
                <span className="font-normal text-gray-400 dark:text-gray-500">
                  {colTasks.length}
                </span>
              </p>
              <ul className="mt-2 space-y-1.5">
                {colTasks.length === 0 ? (
                  <li className="px-1 py-2 text-xs text-gray-400 dark:text-gray-600">
                    비어 있음
                  </li>
                ) : (
                  colTasks.map((t) => {
                    const due = tsToDate(t.dueDate);
                    const overdue =
                      !!due &&
                      t.status !== "done" &&
                      due.getTime() < startOfToday.getTime();
                    return (
                      <li
                        key={t.id}
                        draggable
                        onDragStart={(e) => {
                          // Firefox는 setData 없이는 드래그를 시작하지 않는다
                          e.dataTransfer.setData("text/plain", t.id);
                          e.dataTransfer.effectAllowed = "move";
                          setDragId(t.id);
                        }}
                        onDragEnd={() => {
                          setDragId(null);
                          setDragOver(null);
                        }}
                        className={`cursor-grab rounded-md border border-gray-200 bg-white p-2 shadow-sm active:cursor-grabbing dark:border-gray-700 dark:bg-gray-900 ${
                          dragId === t.id ? "opacity-50" : ""
                        }`}
                      >
                        <p
                          className={`break-words text-sm ${
                            t.status === "done"
                              ? "text-gray-400 line-through dark:text-gray-500"
                              : "text-gray-800 dark:text-gray-200"
                          }`}
                        >
                          {t.title}
                        </p>
                        <div className="mt-1 flex items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
                          <span className="truncate">
                            {t.assigneeName ?? "담당자 없음"}
                          </span>
                          {due && (
                            <span
                              className={
                                overdue
                                  ? "shrink-0 font-semibold text-red-600 dark:text-red-400"
                                  : "shrink-0"
                              }
                            >
                              {formatDate(due)}
                            </span>
                          )}
                        </div>
                        {/* 터치 환경(화면 크기 무관)에서는 드래그 대신 선택으로 상태 변경 */}
                        <select
                          value={t.status}
                          onChange={(e) =>
                            move(t.id, e.target.value as TaskStatus)
                          }
                          aria-label="작업 상태"
                          className="mt-1.5 w-full rounded-md border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-xs text-gray-600 pointer-fine:hidden dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                        >
                          {COLUMNS.map((s) => (
                            <option key={s} value={s}>
                              {TASK_STATUS_LABELS[s]}
                            </option>
                          ))}
                        </select>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
        카드를 끌어 상태를 바꿀 수 있습니다. 작업 수정·삭제는 목록 보기에서
        하세요.
      </p>
    </div>
  );
}
