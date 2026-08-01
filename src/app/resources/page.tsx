"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import AuthGuard from "@/components/AuthGuard";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { ResourceLink } from "@/types";
import { formatDate, tsToDate } from "@/lib/dates";

// 스킴이 없으면 https://를 붙이고, http(s)가 아니면 거부한다
function normalizeUrl(raw: string): string | null {
  let v = raw.trim();
  if (!v) return null;
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
  try {
    const u = new URL(v);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function resourceMillis(r: ResourceLink): number {
  return r.createdAt ? r.createdAt.toMillis() : Number.MAX_SAFE_INTEGER;
}

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500";

function ResourcesContent() {
  const { user, profile } = useAuth();
  const [resources, setResources] = useState<ResourceLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "resources"),
      (snap) => {
        setResources(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ResourceLink)
        );
        setLoadError(null);
        setLoading(false);
      },
      () => {
        setLoadError("자료를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
        setLoading(false);
      }
    );
    return unsubscribe;
  }, []);

  if (!user) return null;

  const isAdmin = profile?.role === "admin";
  const sorted = [...resources].sort(
    (a, b) => resourceMillis(b) - resourceMillis(a)
  );

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile || submitting) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setFormError("자료 제목을 입력하세요.");
      return;
    }
    const normalized = normalizeUrl(url);
    if (!normalized) {
      setFormError("올바른 링크 주소(http/https)를 입력하세요.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await addDoc(collection(db, "resources"), {
        title: trimmedTitle,
        url: normalized,
        description: description.trim(),
        createdBy: user.uid,
        createdByName: profile.name,
        createdAt: serverTimestamp(),
      });
      setTitle("");
      setUrl("");
      setDescription("");
      setShowForm(false);
    } catch {
      setFormError("자료 등록에 실패했습니다. 잠시 후 다시 시도하세요.");
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (r: ResourceLink) => {
    setBusyId(r.id);
    setActionError(null);
    try {
      await deleteDoc(doc(db, "resources", r.id));
    } catch {
      setActionError("자료 삭제에 실패했습니다.");
    } finally {
      setBusyId(null);
      setConfirmDeleteId(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          자료실
        </h1>
        <button
          type="button"
          onClick={() => {
            setShowForm((v) => !v);
            setFormError(null);
          }}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          {showForm ? "닫기" : "자료 추가"}
        </button>
      </div>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        논문·문서·드라이브 등 연구실에서 함께 쓰는 링크를 모아둡니다.
      </p>

      {loadError && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/50 dark:text-red-400">
          {loadError}
        </p>
      )}
      {actionError && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/50 dark:text-red-400">
          {actionError}
        </p>
      )}

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mt-4 space-y-3 rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900"
        >
          <div>
            <label
              htmlFor="resource-title"
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              제목 <span className="text-red-500">*</span>
            </label>
            <input
              id="resource-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={submitting}
              placeholder="자료 이름"
              className={inputClass}
            />
          </div>
          <div>
            <label
              htmlFor="resource-url"
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              링크 <span className="text-red-500">*</span>
            </label>
            <input
              id="resource-url"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={submitting}
              placeholder="https://..."
              className={inputClass}
            />
          </div>
          <div>
            <label
              htmlFor="resource-description"
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              설명
            </label>
            <input
              id="resource-description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitting}
              placeholder="자료 설명 (선택)"
              className={inputClass}
            />
          </div>
          {formError && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {formError}
            </p>
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "등록 중..." : "등록"}
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        {loading ? (
          <p className="p-6 text-center text-sm text-gray-400 dark:text-gray-500">
            불러오는 중...
          </p>
        ) : sorted.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              등록된 자료가 없습니다.
            </p>
            <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
              &quot;자료 추가&quot; 버튼으로 첫 링크를 등록해 보세요.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {sorted.map((r) => {
              const canManage = isAdmin || r.createdBy === user.uid;
              const created = tsToDate(r.createdAt);
              return (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center gap-3 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-words text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {r.title}
                    </a>
                    <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
                      {hostOf(r.url)}
                      {r.description && ` · ${r.description}`}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
                    {r.createdByName}
                    {created && ` · ${formatDate(created)}`}
                  </span>
                  {canManage &&
                    (confirmDeleteId === r.id ? (
                      <span className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => remove(r)}
                          disabled={busyId === r.id}
                          className="rounded-md bg-red-600 px-2 py-0.5 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                        >
                          정말 삭제
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          disabled={busyId === r.id}
                          className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                          취소
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(r.id)}
                        disabled={busyId === r.id}
                        className="shrink-0 text-xs text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                      >
                        삭제
                      </button>
                    ))}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function ResourcesPage() {
  return (
    <AuthGuard>
      <ResourcesContent />
    </AuthGuard>
  );
}
