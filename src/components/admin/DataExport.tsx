"use client";

import { useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { formatDate } from "@/lib/dates";

// 무료 요금제에서 쓸 수 있는 현실적인 백업: 전체 데이터를 JSON으로 내려받는다
const COLLECTIONS = [
  "users",
  "events",
  "tasks",
  "projects",
  "notices",
  "resources",
  "publications",
  "publicProfiles",
  "bookableItems",
  "bookings",
  "rotations",
  "siteContent",
];

export default function DataExport() {
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const exportAll = async () => {
    if (exporting) return;
    setExporting(true);
    setMessage(null);
    try {
      const data: Record<string, Record<string, unknown>> = {};
      let total = 0;
      for (const name of COLLECTIONS) {
        const snap = await getDocs(collection(db, name));
        const docs: Record<string, unknown> = {};
        snap.docs.forEach((d) => {
          docs[d.id] = d.data();
        });
        data[name] = docs;
        total += snap.size;
      }
      const json = JSON.stringify(
        { exportedAt: new Date().toISOString(), data },
        null,
        2
      );
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `edcl-backup-${formatDate(new Date())}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage({
        type: "success",
        text: `문서 ${total}건을 내려받았습니다. 파일을 안전한 곳에 보관하세요.`,
      });
    } catch {
      setMessage({
        type: "error",
        text: "내보내기에 실패했습니다. 잠시 후 다시 시도하세요.",
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">데이터 백업</h2>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          전체 데이터를 JSON 파일로 내려받습니다. 주기적으로 백업해두는 것을
          권장합니다.
        </p>
        <button
          type="button"
          onClick={exportAll}
          disabled={exporting}
          className="shrink-0 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {exporting ? "내보내는 중..." : "JSON 내보내기"}
        </button>
        {message && (
          <p
            className={`w-full text-sm ${
              message.type === "success"
                ? "text-green-700 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {message.text}
          </p>
        )}
      </div>
    </section>
  );
}
