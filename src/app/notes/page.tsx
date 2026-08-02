"use client";

import { Suspense, useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import AuthGuard from "@/components/AuthGuard";
import NoteModal from "@/components/notes/NoteModal";
import { useAuth } from "@/contexts/AuthContext";
import { useModalParam } from "@/hooks/useModalParam";
import { db } from "@/lib/firebase";
import { MeetingNote } from "@/types";

function NotesContent() {
  const { user } = useAuth();
  // ?note=<id>는 상세, ?note=new는 작성 모달을 연다 (검색 딥링크와 같은 규칙)
  const { value: openNoteId, open, close } = useModalParam("note");

  const [notes, setNotes] = useState<MeetingNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "meetingNotes"),
      (snap) => {
        setNotes(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MeetingNote)
        );
        setLoadError(null);
        setLoading(false);
      },
      () => {
        setLoadError("회의록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
        setLoading(false);
      }
    );
    return unsubscribe;
  }, []);

  if (!user) return null;

  const sorted = [...notes].sort((a, b) => (a.date < b.date ? 1 : -1));
  const openNote =
    openNoteId && openNoteId !== "new"
      ? (notes.find((n) => n.id === openNoteId) ?? null)
      : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          회의록
        </h1>
        <button
          type="button"
          onClick={() => open("new")}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          회의록 작성
        </button>
      </div>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        미팅·세미나 기록을 날짜별로 남깁니다. 제목을 누르면 자세히 볼 수 있습니다.
      </p>

      {loadError && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/50 dark:text-red-400">
          {loadError}
        </p>
      )}

      <div className="mt-6 rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        {loading ? (
          <p className="p-6 text-center text-sm text-gray-400 dark:text-gray-500">
            불러오는 중...
          </p>
        ) : sorted.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              작성된 회의록이 없습니다.
            </p>
            <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
              &quot;회의록 작성&quot; 버튼으로 첫 기록을 남겨보세요.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {sorted.map((note) => (
              <li key={note.id}>
                <button
                  type="button"
                  onClick={() => open(note.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/60"
                >
                  <span className="shrink-0 text-sm text-gray-500 dark:text-gray-400">
                    {note.date}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                    {note.title}
                  </span>
                  <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
                    {note.createdByName}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {openNoteId === "new" && <NoteModal note={null} onClose={close} />}
      {openNote && (
        <NoteModal key={openNote.id} note={openNote} onClose={close} />
      )}
    </div>
  );
}

export default function NotesPage() {
  return (
    <AuthGuard>
      {/* useSearchParams 사용 컴포넌트는 Suspense 경계가 필요하다 */}
      <Suspense fallback={null}>
        <NotesContent />
      </Suspense>
    </AuthGuard>
  );
}
