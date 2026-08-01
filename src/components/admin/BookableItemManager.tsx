"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { BookableItem } from "@/types";

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500";

// 예약 페이지에서 쓸 회의실/장비 항목을 관리한다
export default function BookableItemManager() {
  const [items, setItems] = useState<BookableItem[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "bookableItems"), (snap) => {
      setItems(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }) as BookableItem)
      );
    });
    return unsubscribe;
  }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setFormError("항목 이름을 입력하세요.");
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await addDoc(collection(db, "bookableItems"), {
        name: trimmed,
        description: description.trim(),
        createdAt: serverTimestamp(),
      });
      setName("");
      setDescription("");
      setShowForm(false);
    } catch {
      setFormError("등록에 실패했습니다. 잠시 후 다시 시도하세요.");
    } finally {
      setBusy(false);
    }
  };

  // 항목을 지우면 그 항목의 예약 기록도 함께 삭제한다 (고아 문서 방지)
  const remove = async (item: BookableItem) => {
    setBusy(true);
    setActionError(null);
    try {
      const bookingSnap = await getDocs(
        query(collection(db, "bookings"), where("itemId", "==", item.id))
      );
      for (let i = 0; i < bookingSnap.docs.length; i += 450) {
        const batch = writeBatch(db);
        bookingSnap.docs
          .slice(i, i + 450)
          .forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
      await deleteDoc(doc(db, "bookableItems", item.id));
    } catch {
      setActionError("삭제에 실패했습니다. 잠시 후 다시 시도하세요.");
    } finally {
      setBusy(false);
      setConfirmDeleteId(null);
    }
  };

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">예약 항목 (회의실·장비)</h2>
        <button
          type="button"
          onClick={() => {
            setShowForm((v) => !v);
            setFormError(null);
          }}
          className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          {showForm ? "닫기" : "+ 항목 등록"}
        </button>
      </div>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        구성원이 예약 페이지에서 시간대를 잡을 수 있는 항목입니다.
      </p>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mt-3 space-y-3 rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="item-name"
                className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                이름 <span className="text-red-500">*</span>
              </label>
              <input
                id="item-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={busy}
                placeholder="예: 회의실, GPU 서버"
                className={inputClass}
              />
            </div>
            <div>
              <label
                htmlFor="item-description"
                className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                설명
              </label>
              <input
                id="item-description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={busy}
                placeholder="위치·사양 등 (선택)"
                className={inputClass}
              />
            </div>
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
              {busy ? "등록 중..." : "등록"}
            </button>
          </div>
        </form>
      )}

      {actionError && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/50 dark:text-red-400">
          {actionError}
        </p>
      )}

      <div className="mt-3 space-y-2">
        {items.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-sm text-gray-500 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
            등록된 예약 항목이 없습니다.
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="min-w-0">
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {item.name}
                </p>
                {item.description && (
                  <p className="truncate text-sm text-gray-500 dark:text-gray-400">
                    {item.description}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {confirmDeleteId === item.id ? (
                  <>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      예약 기록도 함께 삭제됩니다
                    </span>
                    <button
                      type="button"
                      onClick={() => remove(item)}
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
                    onClick={() => setConfirmDeleteId(item.id)}
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
