"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  addDoc,
  collection,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import AuthGuard from "@/components/AuthGuard";
import ProjectCard from "@/components/projects/ProjectCard";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { Project, Task, UserProfile } from "@/types";

function projectMillis(p: Project): number {
  return p.createdAt ? p.createdAt.toMillis() : Number.MAX_SAFE_INTEGER;
}

function ProjectsContent() {
  const { user, profile } = useAuth();
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
  const isAdmin = profile?.role === "admin";

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
    </div>
  );
}

export default function ProjectsPage() {
  return (
    <AuthGuard>
      <ProjectsContent />
    </AuthGuard>
  );
}
