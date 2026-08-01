"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import AuthGuard from "@/components/AuthGuard";
import ProjectCard from "@/components/projects/ProjectCard";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { formatDate, tsToDate } from "@/lib/dates";
import { Project, Task, UserProfile } from "@/types";

function projectMillis(p: Project): number {
  return p.createdAt ? p.createdAt.toMillis() : Number.MAX_SAFE_INTEGER;
}

function ProjectsContent() {
  const { user, profile } = useAuth();
  const searchParams = useSearchParams();
  const focusId = searchParams.get("project");
  // 같은 페이지에서 연속 검색해도 동작하도록 id 단위로 처리를 기억한다
  const [focusHandledId, setFocusHandledId] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadError, setLoadError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [trashBusyId, setTrashBusyId] = useState<string | null>(null);
  const [trashConfirmId, setTrashConfirmId] = useState<string | null>(null);
  const [trashError, setTrashError] = useState("");

  // 검색 딥링크(?project=<id>)로 진입하면 해당 프로젝트 카드로 스크롤한다
  useEffect(() => {
    if (!focusId || focusHandledId === focusId || projects.length === 0)
      return;
    const target = projects.find((p) => p.id === focusId);
    if (!target) return;
    setFocusHandledId(focusId);
    if (target.status === "archived") setShowArchived(true);
    if (target.status === "deleted") setShowTrash(true);
    setTimeout(() => {
      document
        .getElementById(`project-${focusId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
  }, [focusId, focusHandledId, projects]);

  useEffect(() => {
    const onError = () =>
      setLoadError("데이터를 불러오지 못했습니다. 새로고침 후 다시 시도하세요.");
    const unsubProjects = onSnapshot(
      collection(db, "projects"),
      (snap) => {
        setProjects(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Project)
        );
      },
      onError
    );
    const unsubTasks = onSnapshot(
      collection(db, "tasks"),
      (snap) => {
        setTasks(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Task));
      },
      onError
    );
    const unsubUsers = onSnapshot(
      collection(db, "users"),
      (snap) => {
        setUsers(
          snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as UserProfile)
        );
      },
      onError
    );
    return () => {
      unsubProjects();
      unsubTasks();
      unsubUsers();
    };
  }, []);

  if (!user) return null;

  const approvedUsers = users
    .filter((u) => u.status === "approved")
    .sort((a, b) => a.name.localeCompare(b.name));
  const activeProjects = projects
    .filter((p) => p.status === "active")
    .sort((a, b) => projectMillis(b) - projectMillis(a));
  const archivedProjects = projects
    .filter((p) => p.status === "archived")
    .sort((a, b) => projectMillis(b) - projectMillis(a));
  const deletedProjects = projects
    .filter((p) => p.status === "deleted")
    .sort((a, b) => projectMillis(b) - projectMillis(a));
  const isAdmin = profile?.role === "admin";

  const restoreProject = async (p: Project) => {
    setTrashBusyId(p.id);
    setTrashError("");
    try {
      await updateDoc(doc(db, "projects", p.id), {
        status: "active",
        deletedAt: null,
      });
    } catch {
      setTrashError("복원에 실패했습니다.");
    } finally {
      setTrashBusyId(null);
    }
  };

  const purgeProject = async (p: Project) => {
    setTrashBusyId(p.id);
    setTrashError("");
    try {
      const batch = writeBatch(db);
      tasks
        .filter((t) => t.projectId === p.id)
        .forEach((t) => batch.delete(doc(db, "tasks", t.id)));
      batch.delete(doc(db, "projects", p.id));
      await batch.commit();
    } catch {
      setTrashError("영구 삭제에 실패했습니다.");
    } finally {
      setTrashBusyId(null);
      setTrashConfirmId(null);
    }
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setFormError("프로젝트 이름을 입력하세요.");
      return;
    }
    setSubmitting(true);
    setFormError("");
    try {
      await addDoc(collection(db, "projects"), {
        name: trimmed,
        description: description.trim(),
        status: "active",
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });
      setName("");
      setDescription("");
      setShowForm(false);
    } catch {
      setFormError("프로젝트 생성에 실패했습니다. 잠시 후 다시 시도하세요.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          프로젝트
        </h1>
        <button
          type="button"
          onClick={() => {
            setShowForm((v) => !v);
            setFormError("");
          }}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          새 프로젝트
        </button>
      </div>

      {loadError && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/50 dark:text-red-400">
          {loadError}
        </p>
      )}

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mt-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900"
        >
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            새 프로젝트 만들기
          </h2>
          <div className="mt-3 space-y-3">
            <div>
              <label
                htmlFor="project-name"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                이름 <span className="text-red-500">*</span>
              </label>
              <input
                id="project-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={submitting}
                placeholder="프로젝트 이름"
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
              />
            </div>
            <div>
              <label
                htmlFor="project-description"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                설명
              </label>
              <textarea
                id="project-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={submitting}
                rows={2}
                placeholder="프로젝트 설명 (선택)"
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
              />
            </div>
          </div>
          {formError && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
              {formError}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "생성 중..." : "만들기"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setFormError("");
              }}
              disabled={submitting}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              취소
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 space-y-4">
        {activeProjects.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-10 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              아직 진행 중인 프로젝트가 없습니다.
            </p>
            <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
              위의 &quot;새 프로젝트&quot; 버튼으로 첫 프로젝트를 만들어 보세요.
            </p>
          </div>
        ) : (
          activeProjects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              tasks={tasks.filter((t) => t.projectId === p.id)}
              approvedUsers={approvedUsers}
              currentUid={user.uid}
              isAdmin={isAdmin}
            />
          ))
        )}
      </div>

      <div className="mt-8">
        <button
          type="button"
          onClick={() => setShowArchived((v) => !v)}
          className="text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          {showArchived
            ? "보관된 프로젝트 숨기기"
            : `보관된 프로젝트 보기 (${archivedProjects.length})`}
        </button>
        {showArchived && (
          <div className="mt-3 space-y-4">
            {archivedProjects.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500">
                보관된 프로젝트가 없습니다.
              </p>
            ) : (
              archivedProjects.map((p) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  tasks={tasks.filter((t) => t.projectId === p.id)}
                  approvedUsers={approvedUsers}
                  currentUid={user.uid}
                  isAdmin={isAdmin}
                />
              ))
            )}
          </div>
        )}
      </div>

      {deletedProjects.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowTrash((v) => !v)}
            className="text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            {showTrash
              ? "휴지통 숨기기"
              : `휴지통 보기 (${deletedProjects.length})`}
          </button>
          {showTrash && (
            <div className="mt-3 rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
              {trashError && (
                <p className="border-b border-gray-100 px-4 py-2 text-sm text-red-600 dark:border-gray-800 dark:text-red-400">
                  {trashError}
                </p>
              )}
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {deletedProjects.map((p) => {
                  const canManage = isAdmin || p.createdBy === user.uid;
                  const taskCount = tasks.filter(
                    (t) => t.projectId === p.id
                  ).length;
                  const deleted = tsToDate(p.deletedAt ?? null);
                  return (
                    <li
                      key={p.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                          {p.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          작업 {taskCount}개
                          {deleted && ` · ${formatDate(deleted)} 삭제`}
                        </p>
                      </div>
                      {canManage && (
                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            onClick={() => restoreProject(p)}
                            disabled={trashBusyId === p.id}
                            className="rounded-md border border-gray-300 px-2.5 py-1 text-xs text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                          >
                            복원
                          </button>
                          {trashConfirmId === p.id ? (
                            <>
                              <button
                                type="button"
                                onClick={() => purgeProject(p)}
                                disabled={trashBusyId === p.id}
                                className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                              >
                                되돌릴 수 없음, 영구 삭제
                              </button>
                              <button
                                type="button"
                                onClick={() => setTrashConfirmId(null)}
                                disabled={trashBusyId === p.id}
                                className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                              >
                                취소
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setTrashConfirmId(p.id)}
                              disabled={trashBusyId === p.id}
                              className="rounded-md border border-red-300 px-2.5 py-1 text-xs text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
                            >
                              영구 삭제
                            </button>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ProjectsPage() {
  return (
    <AuthGuard>
      {/* useSearchParams 사용 컴포넌트는 Suspense 경계가 필요하다 */}
      <Suspense fallback={null}>
        <ProjectsContent />
      </Suspense>
    </AuthGuard>
  );
}
