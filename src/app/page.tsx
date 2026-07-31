"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import AuthGuard from "@/components/AuthGuard";
import { LabEvent, Project, Task } from "@/types";
import {
  formatDate,
  formatDateTime,
  formatTime,
  isSameDay,
  WEEKDAY_LABELS,
} from "@/lib/dates";

function formatKoreanDate(d: Date): string {
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${
    WEEKDAY_LABELS[d.getDay()]
  })`;
}

function eventTimeLabel(ev: LabEvent): string {
  const start = ev.start.toDate();
  const end = ev.end.toDate();
  if (ev.allDay) {
    return isSameDay(start, end)
      ? formatDate(start)
      : `${formatDate(start)} ~ ${formatDate(end)}`;
  }
  if (isSameDay(start, end)) {
    return `${formatDate(start)} ${formatTime(start)} ~ ${formatTime(end)}`;
  }
  return `${formatDateTime(start)} ~ ${formatDateTime(end)}`;
}

function DashboardContent() {
  const [events, setEvents] = useState<LabEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [tasksError, setTasksError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "events"),
      (snap) => {
        setEvents(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as LabEvent)
        );
        setEventsError(null);
        setEventsLoading(false);
      },
      () => {
        setEventsError("일정을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
        setEventsLoading(false);
      }
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "tasks"),
      (snap) => {
        setTasks(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Task));
        setTasksError(null);
        setTasksLoading(false);
      },
      () => {
        setTasksError("작업을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
        setTasksLoading(false);
      }
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "projects"),
      (snap) => {
        setProjects(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Project)
        );
        setProjectsLoading(false);
      },
      () => {
        setTasksError("프로젝트를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
        setProjectsLoading(false);
      }
    );
    return unsubscribe;
  }, []);

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const current = now.getTime();
  const upcomingEvents = events
    .filter((ev) => ev.end && ev.end.toDate().getTime() > current)
    .sort((a, b) => a.start.toDate().getTime() - b.start.toDate().getTime())
    .slice(0, 5);

  const taskGroups = useMemo(() => {
    const inProgress = tasks.filter((t) => t.status === "in_progress");
    const nameById = new Map(projects.map((p) => [p.id, p.name]));
    const byProject = new Map<string, Task[]>();
    for (const task of inProgress) {
      const list = byProject.get(task.projectId);
      if (list) {
        list.push(task);
      } else {
        byProject.set(task.projectId, [task]);
      }
    }
    return Array.from(byProject.entries())
      .map(([projectId, groupTasks]) => ({
        projectId,
        projectName: nameById.get(projectId) ?? "(알 수 없는 프로젝트)",
        tasks: groupTasks.sort((a, b) => {
          const ad = a.dueDate ? a.dueDate.toDate().getTime() : Infinity;
          const bd = b.dueDate ? b.dueDate.toDate().getTime() : Infinity;
          if (ad !== bd) return ad - bd;
          return a.title.localeCompare(b.title, "ko");
        }),
      }))
      .sort((a, b) => a.projectName.localeCompare(b.projectName, "ko"));
  }, [tasks, projects]);

  const tasksSectionLoading = tasksLoading || projectsLoading;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold">대시보드</h1>
        <p className="text-sm text-gray-500">{formatKoreanDate(now)}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* 다가오는 일정 */}
        <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <h2 className="font-semibold text-gray-900">다가오는 일정</h2>
            <Link
              href="/calendar"
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              전체 보기 →
            </Link>
          </div>
          <div className="px-4 py-3">
            {eventsError ? (
              <p className="py-4 text-sm text-red-600">{eventsError}</p>
            ) : eventsLoading ? (
              <p className="py-4 text-sm text-gray-400">불러오는 중...</p>
            ) : upcomingEvents.length === 0 ? (
              <p className="py-4 text-sm text-gray-500">
                예정된 일정이 없습니다.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {upcomingEvents.map((ev) => (
                  <li key={ev.id} className="py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-gray-900">
                        {ev.title}
                      </span>
                      {isSameDay(ev.start.toDate(), now) && (
                        <span className="shrink-0 rounded-full bg-blue-600 px-2 py-0.5 text-xs font-medium text-white">
                          오늘
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-gray-500">
                      <span>{eventTimeLabel(ev)}</span>
                      <span className="text-gray-300">·</span>
                      <span>{ev.createdByName}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* 진행중인 작업 */}
        <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <h2 className="font-semibold text-gray-900">진행중인 작업</h2>
            <Link
              href="/projects"
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              전체 보기 →
            </Link>
          </div>
          <div className="px-4 py-3">
            {tasksError ? (
              <p className="py-4 text-sm text-red-600">{tasksError}</p>
            ) : tasksSectionLoading ? (
              <p className="py-4 text-sm text-gray-400">불러오는 중...</p>
            ) : taskGroups.length === 0 ? (
              <p className="py-4 text-sm text-gray-500">
                진행중인 작업이 없습니다.
              </p>
            ) : (
              <div className="space-y-4">
                {taskGroups.map((group) => (
                  <div key={group.projectId}>
                    <h3 className="mb-1 text-sm font-semibold text-blue-700">
                      {group.projectName}
                    </h3>
                    <ul className="divide-y divide-gray-100">
                      {group.tasks.map((task) => {
                        const due = task.dueDate ? task.dueDate.toDate() : null;
                        const overdue =
                          due !== null && due.getTime() < startOfToday.getTime();
                        return (
                          <li
                            key={task.id}
                            className="flex items-center justify-between gap-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-gray-900">
                                {task.title}
                              </p>
                              <p className="text-xs text-gray-500">
                                {task.assigneeName ?? "담당자 없음"}
                              </p>
                            </div>
                            {due && (
                              <span
                                className={`shrink-0 text-xs ${
                                  overdue
                                    ? "font-medium text-red-600"
                                    : "text-gray-500"
                                }`}
                              >
                                ~{formatDate(due)}
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}
