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
import { upload } from "@vercel/blob/client";
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

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${bytes}B`;
}

type FormMode = "link" | "file";

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500";

function ResourcesContent() {
  const { user, profile } = useAuth();
  const [resources, setResources] = useState<ResourceLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("link");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);

  // 파일 업로드 구성 상태: null=확인 전, true/false=서버 응답
  const [uploadConfigured, setUploadConfigured] = useState<boolean | null>(
    null
  );
  const [uploadMaxSize, setUploadMaxSize] = useState(50 * 1024 * 1024);

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

  // 폼을 처음 열 때 파일 업로드 사용 가능 여부를 서버에 확인한다
  useEffect(() => {
    if (!showForm || uploadConfigured !== null || !user) return;
    let cancelled = false;
    void (async () => {
      try {
        const idToken = await user.getIdToken();
        const res = await fetch("/api/resources/upload", {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        const data = (await res.json().catch(() => null)) as {
          configured?: boolean;
          maxSize?: number;
        } | null;
        if (cancelled) return;
        // 성공 응답일 때만 확정한다 — 일시적 네트워크/인증 오류를 "미설정"으로
        // 고정하면 폼을 다시 열어도 재확인하지 않으므로 null을 유지해 재시도를 남긴다
        if (res.ok) {
          setUploadConfigured(Boolean(data?.configured));
          if (data?.maxSize) setUploadMaxSize(data.maxSize);
        }
      } catch {
        // null 유지 — 폼을 닫았다 열면 다시 확인한다
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showForm, uploadConfigured, user]);

  if (!user) return null;

  const isAdmin = profile?.role === "admin";
  const sorted = [...resources].sort(
    (a, b) => resourceMillis(b) - resourceMillis(a)
  );

  const resetForm = () => {
    setTitle("");
    setUrl("");
    setDescription("");
    setFile(null);
    setUploadPct(null);
    setShowForm(false);
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile || submitting) return;

    if (formMode === "link") {
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
        resetForm();
      } catch {
        setFormError("자료 등록에 실패했습니다. 잠시 후 다시 시도하세요.");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // 파일 모드
    if (!file) {
      setFormError("업로드할 파일을 선택하세요.");
      return;
    }
    if (file.size > uploadMaxSize) {
      setFormError(
        `파일이 너무 큽니다. 최대 ${formatFileSize(uploadMaxSize)}까지 올릴 수 있습니다.`
      );
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const idToken = await user.getIdToken();
      // 경로에 본인 uid를 포함해야 서버가 blob 소유권을 검증할 수 있다 (업로드 라우트가 강제)
      let blobUrl: string;
      try {
        const blob = await upload(`resources/${user.uid}/${file.name}`, file, {
          access: "public",
          handleUploadUrl: "/api/resources/upload",
          headers: { Authorization: `Bearer ${idToken}` },
          onUploadProgress: ({ percentage }) => setUploadPct(percentage),
        });
        blobUrl = blob.url;
      } catch {
        setFormError("파일 업로드에 실패했습니다. 잠시 후 다시 시도하세요.");
        return;
      }
      try {
        await addDoc(collection(db, "resources"), {
          title: title.trim() || file.name,
          url: blobUrl,
          description: description.trim(),
          fileName: file.name,
          fileSize: file.size,
          createdBy: user.uid,
          createdByName: profile.name,
          createdAt: serverTimestamp(),
        });
        resetForm();
      } catch {
        // 문서 생성에 실패하면 방금 올린 파일을 되돌려 고아 blob이 쌓이지 않게 한다
        void fetch("/api/resources/delete-file", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ blobUrl }),
        }).catch(() => {});
        setFormError(
          "파일은 업로드됐지만 자료 등록에 실패했습니다. 다시 시도하세요."
        );
      }
    } finally {
      setSubmitting(false);
      setUploadPct(null);
    }
  };

  const remove = async (r: ResourceLink) => {
    setBusyId(r.id);
    setActionError(null);
    try {
      // 업로드 파일 자료면 Blob의 실제 파일부터 지운다 (실패 시 문서도 남겨 재시도 가능)
      if (r.fileName) {
        const idToken = await user.getIdToken();
        const res = await fetch("/api/resources/delete-file", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ resourceId: r.id }),
        });
        const data = (await res.json().catch(() => null)) as {
          configured?: boolean;
          deleted?: boolean;
          reason?: string;
        } | null;
        if (!res.ok || !data) {
          setActionError("파일 삭제에 실패했습니다. 잠시 후 다시 시도하세요.");
          return;
        }
        if (data.configured === false) {
          // 파일을 못 지우는 상태에서 문서만 지우면 고아 blob이 남는다 — 중단
          setActionError(
            "파일 저장소가 설정되지 않아 파일 자료를 삭제할 수 없습니다."
          );
          return;
        }
        if (!data.deleted && data.reason !== "not-a-file") {
          setActionError("파일 삭제에 실패했습니다. 잠시 후 다시 시도하세요.");
          return;
        }
      }
      await deleteDoc(doc(db, "resources", r.id));
    } catch {
      setActionError("자료 삭제에 실패했습니다.");
    } finally {
      setBusyId(null);
      setConfirmDeleteId(null);
    }
  };

  const modeTabClass = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
      active
        ? "bg-blue-600 text-white"
        : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
    }`;

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
        논문·문서·드라이브 등 연구실에서 함께 쓰는 링크와 파일을 모아둡니다.
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
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => {
                setFormMode("link");
                setFormError(null);
              }}
              disabled={submitting}
              aria-pressed={formMode === "link"}
              className={modeTabClass(formMode === "link")}
            >
              링크
            </button>
            <button
              type="button"
              onClick={() => {
                setFormMode("file");
                setFormError(null);
              }}
              disabled={submitting}
              aria-pressed={formMode === "file"}
              className={modeTabClass(formMode === "file")}
            >
              파일 업로드
            </button>
          </div>

          {formMode === "file" && uploadConfigured === false && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
              파일 업로드가 아직 설정되지 않았습니다. 관리자가 Vercel Blob
              스토어를 활성화하면 사용할 수 있습니다.
            </p>
          )}

          <div>
            <label
              htmlFor="resource-title"
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              제목 {formMode === "link" && <span className="text-red-500">*</span>}
            </label>
            <input
              id="resource-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={submitting}
              placeholder={
                formMode === "link" ? "자료 이름" : "비우면 파일 이름을 사용"
              }
              className={inputClass}
            />
          </div>

          {formMode === "link" ? (
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
          ) : (
            <div>
              <label
                htmlFor="resource-file"
                className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                파일 <span className="text-red-500">*</span>
              </label>
              <input
                id="resource-file"
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                disabled={submitting || uploadConfigured === false}
                className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100 dark:text-gray-400 dark:file:bg-gray-800 dark:file:text-blue-300"
              />
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                최대 {formatFileSize(uploadMaxSize)}
                {file && ` · 선택됨: ${file.name} (${formatFileSize(file.size)})`}
              </p>
            </div>
          )}

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
          {uploadPct !== null && (
            <div
              className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
              role="progressbar"
              aria-label="파일 업로드 진행률"
              aria-valuenow={Math.round(uploadPct)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full bg-blue-600 transition-all"
                style={{ width: `${uploadPct}%` }}
              />
            </div>
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={
                submitting || (formMode === "file" && uploadConfigured === false)
              }
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting
                ? formMode === "file"
                  ? "업로드 중..."
                  : "등록 중..."
                : "등록"}
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
                      {r.fileName ? (
                        <>
                          <span className="mr-1 rounded bg-gray-100 px-1.5 py-0.5 font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                            파일
                          </span>
                          {r.fileName}
                          {typeof r.fileSize === "number" &&
                            ` (${formatFileSize(r.fileSize)})`}
                        </>
                      ) : (
                        hostOf(r.url)
                      )}
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
