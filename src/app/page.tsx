"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  collection,
  onSnapshot,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import AuthGuard from "@/components/AuthGuard";
import NoticeBoard from "@/components/NoticeBoard";
import PublicHome from "@/components/PublicHome";
import RotationCard from "@/components/RotationCard";
import { useAuth } from "@/contexts/AuthContext";
import { LabEvent, Project, Task, TASK_STATUS_LABELS } from "@/types";
import { eventCategory, eventCategoryStyle } from "@/lib/eventCategories";
import { daysUntil, formatDate, isSameDay, WEEKDAY_LABELS } from "@/lib/dates";

function formatKoreanDate(d: Date): string {
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${
    WEEKDAY_LABELS[d.getDay()]
  })`;
}

function eventDateLabel(ev: LabEvent): string {
  const start = ev.start.toDate();
  const end = ev.end.toDate();
  return isSameDay(start, end)
    ? formatDate(start)
    : `${formatDate(start)} ~ ${formatDate(end)}`;
}

function DashboardContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const initialNoticeId = searchParams.get("notice");
  const [events, setEvents] = useState<LabEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [tasksError, setTasksError] = useState<string | null>(null);

  // 지난 일정은 대시보드에 필요 없으므로 오늘 이후 종료되는 일정만 구독한다
  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const unsubscribe = onSnapshot(
      query(
        collection(db, "events"),
        where("end", ">=", Timestamp.fromDate(today))
      ),
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

  // 완료된 작업은 대시보드에 표시하지 않으므로 미완료 작업만 구독한다
  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(
        collection(db, "tasks"),
        where("status", "in", ["todo", "in_progress"])
      ),
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

  // 휴지통(deleted) 프로젝트의 작업은 대시보드에서 제외한다
  const liveProjectIds = new Set(
    projects.filter((p) => p.status !== "deleted").map((p) => p.id)
  );

  // 내가 담당자인 미완료 작업 (마감일 빠른 순, 마감일 없으면 뒤로)
  const projectNameById = new Map(projects.map((p) => [p.id, p.name]));
  const myTasks = user
    ? tasks
        .filter(
          (t) =>
            t.assigneeUid === user.uid &&
            t.status !== "done" &&
            liveProjectIds.has(t.projectId)
        )
        .sort((a, b) => {
          const ad = a.dueDate ? a.dueDate.toMillis() : Infinity;
          const bd = b.dueDate ? b.dueDate.toMillis() : Infinity;
          if (ad !== bd) return ad - bd;
          return a.title.localeCompare(b.title, "ko");
        })
    : [];

  const taskGroups = useMemo(() => {
    const live = new Set(
      projects.filter((p) => p.status !== "deleted").map((p) => p.id)
    );
    const inProgress = tasks.filter(
      (t) => t.status === "in_progress" && live.has(t.projectId)
    );
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
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {formatKoreanDate(now)}
        </p>
      </div>

      <NoticeBoard initialNoticeId={initialNoticeId} />

      <RotationCard />

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* 내 작업 */}
        <section className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">
              내 작업
            </h2>
            <Link
              href="/projects"
              className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              전체 보기 →
            </Link>
          </div>
          <div className="px-4 py-3">
            {tasksError ? (
              <p className="py-4 text-sm text-red-600 dark:text-red-400">
                {tasksError}
              </p>
            ) : tasksSectionLoading ? (
              <p className="py-4 text-sm text-gray-400 dark:text-gray-500">
                불러오는 중...
              </p>
            ) : myTasks.length === 0 ? (
              <p className="py-4 text-sm text-gray-500 dark:text-gray-400">
                담당한 작업이 없습니다.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {myTasks.map((task) => {
                  const due = task.dueDate ? task.dueDate.toDate() : null;
                  const overdue =
                    due !== null && due.getTime() < startOfToday.getTime();
                  return (
                    <li
                      key={task.id}
                      className="flex items-center justify-between gap-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                          {task.title}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {projectNameById.get(task.projectId) ??
                            "(알 수 없는 프로젝트)"}{" "}
                          · {TASK_STATUS_LABELS[task.status]}
                        </p>
                      </div>
                      {due && (
                        <span
                          className={`shrink-0 text-xs ${
                            overdue
                              ? "font-medium text-red-600 dark:text-red-400"
                              : "text-gray-500 dark:text-gray-400"
                          }`}
                        >
                          ~{formatDate(due)}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* 다가오는 일정 */}
        <section className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">다가오는 일정</h2>
            <Link
              href="/calendar"
              className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              전체 보기 →
            </Link>
          </div>
          <div className="px-4 py-3">
            {eventsError ? (
              <p className="py-4 text-sm text-red-600 dark:text-red-400">{eventsError}</p>
            ) : eventsLoading ? (
              <p className="py-4 text-sm text-gray-400 dark:text-gray-500">
                불러오는 중...
              </p>
            ) : upcomingEvents.length === 0 ? (
              <p className="py-4 text-sm text-gray-500 dark:text-gray-400">
                예정된 일정이 없습니다.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {upcomingEvents.map((ev) => (
                  <li key={ev.id} className="py-2.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${eventCategoryStyle(ev).dot}`}
                      />
                      <span className="truncate font-medium text-gray-900 dark:text-gray-100">
                        {ev.title}
                      </span>
                      {eventCategory(ev) === "deadline" ? (
                        (() => {
                          const dd = daysUntil(ev.start.toDate());
                          return dd >= 0 ? (
                            <span className="shrink-0 rounded-full bg-red-600 px-2 py-0.5 text-xs font-medium text-white">
                              {dd === 0 ? "D-DAY" : `D-${dd}`}
                            </span>
                          ) : null;
                        })()
                      ) : (
                        isSameDay(ev.start.toDate(), now) && (
                          <span className="shrink-0 rounded-full bg-blue-600 px-2 py-0.5 text-xs font-medium text-white">
                            오늘
                          </span>
                        )
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-gray-500 dark:text-gray-400">
                      <span>{eventDateLabel(ev)}</span>
                      <span className="text-gray-300 dark:text-gray-600">·</span>
                      <span>{ev.createdByName}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

      </div>

      {/* 진행중인 작업 */}
      <section className="mt-6 rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">진행중인 작업</h2>
            <Link
              href="/projects"
              className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              전체 보기 →
            </Link>
          </div>
          <div className="px-4 py-3">
            {tasksError ? (
              <p className="py-4 text-sm text-red-600 dark:text-red-400">{tasksError}</p>
            ) : tasksSectionLoading ? (
              <p className="py-4 text-sm text-gray-400 dark:text-gray-500">
                불러오는 중...
              </p>
            ) : taskGroups.length === 0 ? (
              <p className="py-4 text-sm text-gray-500 dark:text-gray-400">
                진행중인 작업이 없습니다.
              </p>
            ) : (
              <div className="space-y-4">
                {taskGroups.map((group) => (
                  <div key={group.projectId}>
                    <h3 className="mb-1 text-sm font-semibold text-blue-700 dark:text-blue-400">
                      {group.projectName}
                    </h3>
                    <ul className="divide-y divide-gray-100 dark:divide-gray-800">
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
                              <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                                {task.title}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {task.assigneeName ?? "담당자 없음"}
                              </p>
                            </div>
                            {due && (
                              <span
                                className={`shrink-0 text-xs ${
                                  overdue
                                    ? "font-medium text-red-600 dark:text-red-400"
                                    : "text-gray-500 dark:text-gray-400"
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
  );
}

export default function Home() {
  const { user, loading } = useAuth();

  // 로그아웃 상태에서는 공개 소개 페이지, 로그인 상태에서는 대시보드를 보여준다
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600 dark:border-blue-950 dark:border-t-blue-500" />
      </div>
    );
  }
  if (!user) {
    return <PublicHome />;
  }
  return (
    <AuthGuard>
      {/* useSearchParams 사용 컴포넌트는 Suspense 경계가 필요하다 */}
      <Suspense fallback={null}>
        <DashboardContent />
      </Suspense>
    </AuthGuard>
  );
}
