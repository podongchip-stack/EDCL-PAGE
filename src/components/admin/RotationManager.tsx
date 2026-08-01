"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Rotation } from "@/types";
import { formatDate } from "@/lib/dates";
import { currentAssignee } from "@/lib/rotations";

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500";

// 세미나 발표·청소 등 주 단위 순번을 등록/수정/삭제한다
export default function RotationManager() {
  const [rotations, setRotations] = useState<Rotation[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [membersText, setMembersText] = useState("");
  const [anchorDate, setAnchorDate] = useState(formatDate(new Date()));
  const [intervalWeeks, setIntervalWeeks] = useState("1");
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "rotations"), (snap) => {
      setRotations(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Rotation)
      );
    });
    return unsubscribe;
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setMembersText("");
    setAnchorDate(formatDate(new Date()));
    setIntervalWeeks("1");
    setFormError(null);
  };

  const startEdit = (r: Rotation) => {
    setEditingId(r.id);
    setTitle(r.title);
    setMembersText(r.members.join("\n"));
    setAnchorDate(r.anchorDate);
    setIntervalWeeks(String(r.intervalWeeks));
    setFormError(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const trimmedTitle = title.trim();
    const members = membersText
      .split("\n")
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
    if (!trimmedTitle) {
      setFormError("순번 이름을 입력하세요.");
      return;
    }
    if (members.length === 0) {
      setFormError("구성원을 한 줄에 한 명씩 입력하세요.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(anchorDate)) {
      setFormError("시작 주 날짜를 선택하세요.");
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const data = {
        title: trimmedTitle,
        members,
        anchorDate,
        intervalWeeks: Number(intervalWeeks),
      };
      if (editingId) {
        await updateDoc(doc(db, "rotations", editingId), data);
      } else {
        await addDoc(collection(db, "rotations"), {
          ...data,
          createdAt: serverTimestamp(),
        });
      }
      resetForm();
      setShowForm(false);
    } catch {
      setFormError("저장에 실패했습니다. 잠시 후 다시 시도하세요.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (r: Rotation) => {
    setBusy(true);
    try {
      await deleteDoc(doc(db, "rotations", r.id));
    } finally {
      setBusy(false);
      setConfirmDeleteId(null);
    }
  };

  const now = new Date();

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">담당 순번</h2>
        <button
          type="button"
          onClick={() => {
            if (showForm) {
              resetForm();
              setShowForm(false);
            } else {
              setShowForm(true);
            }
          }}
          className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          {showForm ? "닫기" : "+ 순번 등록"}
        </button>
      </div>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        세미나 발표·청소 같은 주 단위 순번입니다. 대시보드에 이번 담당자가
        표시됩니다.
      </p>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mt-3 space-y-3 rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label
                htmlFor="rotation-title"
                className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                이름 <span className="text-red-500">*</span>
              </label>
              <input
                id="rotation-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={busy}
                placeholder="예: 세미나 발표"
                className={inputClass}
              />
            </div>
            <div>
              <label
                htmlFor="rotation-anchor"
                className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                첫 담당 주 <span className="text-red-500">*</span>
              </label>
              <input
                id="rotation-anchor"
                type="date"
                value={anchorDate}
                onChange={(e) => setAnchorDate(e.target.value)}
                disabled={busy}
                className={inputClass}
              />
            </div>
            <div>
              <label
                htmlFor="rotation-interval"
                className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                주기
              </label>
              <select
                id="rotation-interval"
                value={intervalWeeks}
                onChange={(e) => setIntervalWeeks(e.target.value)}
                disabled={busy}
                className={inputClass}
              >
                <option value="1">매주</option>
                <option value="2">2주마다</option>
                <option value="4">4주마다</option>
              </select>
            </div>
          </div>
          <div>
            <label
              htmlFor="rotation-members"
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              순번 명단 (한 줄에 한 명, 위에서부터 순서대로){" "}
              <span className="text-red-500">*</span>
            </label>
            <textarea
              id="rotation-members"
              value={membersText}
              onChange={(e) => setMembersText(e.target.value)}
              rows={4}
              disabled={busy}
              placeholder={"홍길동\n김철수\n이영희"}
              className={inputClass}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              &quot;첫 담당 주&quot;가 속한 주에 첫 번째 사람이 담당합니다.
            </p>
          </div>
          {formError && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {formError}
            </p>
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {busy ? "저장 중..." : editingId ? "수정 저장" : "등록"}
            </button>
          </div>
        </form>
      )}

      <div className="mt-3 space-y-2">
        {rotations.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-sm text-gray-500 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
            등록된 순번이 없습니다.
          </div>
        ) : (
          rotations.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="min-w-0">
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {r.title}
                  <span className="ml-2 text-sm font-normal text-blue-700 dark:text-blue-400">
                    이번 담당: {currentAssignee(r, now) ?? "-"}
                  </span>
                </p>
                <p className="truncate text-sm text-gray-500 dark:text-gray-400">
                  {r.members.join(" → ")} ·{" "}
                  {r.intervalWeeks > 1 ? `${r.intervalWeeks}주마다` : "매주"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => startEdit(r)}
                  disabled={busy}
                  className="rounded-md border border-gray-300 px-2.5 py-1 text-xs text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  수정
                </button>
                {confirmDeleteId === r.id ? (
                  <>
                    <button
                      type="button"
                      onClick={() => remove(r)}
                      disabled={busy}
                      className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                    >
                      정말 삭제
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      disabled={busy}
                      className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      취소
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(r.id)}
                    disabled={busy}
                    className="rounded-md border border-red-300 px-2.5 py-1 text-xs text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
                  >
                    삭제
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
