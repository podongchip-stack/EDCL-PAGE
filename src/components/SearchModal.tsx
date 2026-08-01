"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  LabEvent,
  MeetingNote,
  Notice,
  Project,
  Reading,
  ResourceLink,
  Task,
} from "@/types";
import { formatDate, tsToDate } from "@/lib/dates";

interface SearchModalProps {
  onClose: () => void;
}

interface SearchData {
  events: LabEvent[];
  projects: Project[];
  tasks: Task[];
  notices: Notice[];
  resources: ResourceLink[];
  meetingNotes: MeetingNote[];
  readings: Reading[];
}

const MAX_PER_GROUP = 5;

function matches(q: string, ...fields: (string | undefined | null)[]): boolean {
  return fields.some((f) => f && f.toLowerCase().includes(q));
}

// 열릴 때 한 번 전체 데이터를 받아 클라이언트에서 검색한다 (연구실 규모에 충분)
export default function SearchModal({ onClose }: SearchModalProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [data, setData] = useState<SearchData | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getDocs(collection(db, "events")),
      getDocs(collection(db, "projects")),
      getDocs(collection(db, "tasks")),
      getDocs(collection(db, "notices")),
      getDocs(collection(db, "resources")),
      getDocs(collection(db, "meetingNotes")),
      getDocs(collection(db, "readings")),
    ])
      .then(([ev, pr, ta, no, re, mn, rd]) => {
        if (cancelled) return;
        const projects = pr.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as Project
        );
        const liveIds = new Set(
          projects.filter((p) => p.status !== "deleted").map((p) => p.id)
        );
        setData({
          events: ev.docs.map((d) => ({ id: d.id, ...d.data() }) as LabEvent),
          projects: projects.filter((p) => p.status !== "deleted"),
          tasks: ta.docs
            .map((d) => ({ id: d.id, ...d.data() }) as Task)
            .filter((t) => liveIds.has(t.projectId)),
          notices: no.docs.map((d) => ({ id: d.id, ...d.data() }) as Notice),
          resources: re.docs.map(
            (d) => ({ id: d.id, ...d.data() }) as ResourceLink
          ),
          meetingNotes: mn.docs.map(
            (d) => ({ id: d.id, ...d.data() }) as MeetingNote
          ),
          readings: rd.docs.map(
            (d) => ({ id: d.id, ...d.data() }) as Reading
          ),
        });
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const q = query.trim().toLowerCase();

  const go = (path: string) => {
    router.push(path);
    onClose();
  };

  const groups =
    data && q
      ? [
          {
            key: "events",
            label: "일정",
            items: data.events
              .filter((ev) => matches(q, ev.title, ev.description))
              .slice(0, MAX_PER_GROUP)
              .map((ev) => {
                const start = tsToDate(ev.start);
                return {
                  id: ev.id,
                  title: ev.title,
                  detail: start ? formatDate(start) : "",
                  onSelect: () => go(`/calendar?event=${ev.id}`),
                };
              }),
          },
          {
            key: "projects",
            label: "프로젝트",
            items: data.projects
              .filter((p) => matches(q, p.name, p.description))
              .slice(0, MAX_PER_GROUP)
              .map((p) => ({
                id: p.id,
                title: p.name,
                detail: p.status === "archived" ? "보관됨" : "진행 중",
                onSelect: () => go(`/projects?project=${p.id}`),
              })),
          },
          {
            key: "tasks",
            label: "작업",
            items: data.tasks
              .filter((t) => matches(q, t.title, t.assigneeName))
              .slice(0, MAX_PER_GROUP)
              .map((t) => ({
                id: t.id,
                title: t.title,
                detail: t.assigneeName ?? "담당자 없음",
                onSelect: () => go(`/projects?project=${t.projectId}`),
              })),
          },
          {
            key: "notices",
            label: "공지",
            items: data.notices
              .filter((n) => matches(q, n.title, n.content))
              .slice(0, MAX_PER_GROUP)
              .map((n) => ({
                id: n.id,
                title: n.title,
                detail: n.createdByName,
                onSelect: () => go(`/?notice=${n.id}`),
              })),
          },
          {
            key: "resources",
            label: "자료",
            items: data.resources
              .filter((r) => matches(q, r.title, r.description, r.url))
              .slice(0, MAX_PER_GROUP)
              .map((r) => ({
                id: r.id,
                title: r.title,
                detail: r.createdByName,
                onSelect: () => go("/resources"),
              })),
          },
          {
            key: "meetingNotes",
            label: "회의록",
            items: data.meetingNotes
              .filter((n) => matches(q, n.title, n.content))
              .slice(0, MAX_PER_GROUP)
              .map((n) => ({
                id: n.id,
                title: n.title,
                detail: n.date,
                onSelect: () => go(`/notes?note=${n.id}`),
              })),
          },
          {
            key: "readings",
            label: "저널클럽",
            items: data.readings
              .filter((r) => matches(q, r.title, r.presenterName))
              .slice(0, MAX_PER_GROUP)
              .map((r) => ({
                id: r.id,
                title: r.title,
                detail: r.presenterName || "발표자 미정",
                onSelect: () => go("/journal-club"),
              })),
          },
        ].filter((g) => g.items.length > 0)
      : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[12vh]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-800 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="일정, 프로젝트, 작업, 공지, 자료 검색..."
          aria-label="통합 검색"
          autoFocus
          className="w-full rounded-t-lg border-b border-gray-200 bg-transparent px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none dark:border-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
        />
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {loadError ? (
            <p className="px-3 py-6 text-center text-sm text-red-600 dark:text-red-400">
              데이터를 불러오지 못했습니다. 닫고 다시 시도해주세요.
            </p>
          ) : !data ? (
            <p className="px-3 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
              불러오는 중...
            </p>
          ) : !q ? (
            <p className="px-3 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
              검색어를 입력하세요.
            </p>
          ) : groups.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              &quot;{query.trim()}&quot;에 대한 결과가 없습니다.
            </p>
          ) : (
            groups.map((g) => (
              <div key={g.key} className="mb-2">
                <p className="px-3 py-1 text-xs font-semibold text-gray-400 dark:text-gray-500">
                  {g.label}
                </p>
                <ul>
                  {g.items.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={item.onSelect}
                        className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                      >
                        <span className="min-w-0 flex-1 truncate text-sm text-gray-900 dark:text-gray-100">
                          {item.title}
                        </span>
                        <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
                          {item.detail}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
        <p className="border-t border-gray-100 px-4 py-2 text-xs text-gray-400 dark:border-gray-800 dark:text-gray-500">
          Esc로 닫기 · Ctrl+K로 열기
        </p>
      </div>
    </div>
  );
}
