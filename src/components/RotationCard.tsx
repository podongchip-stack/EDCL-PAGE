"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Rotation } from "@/types";
import { currentAssignee, nextAssignee } from "@/lib/rotations";

// 등록된 순번이 없으면 아무것도 렌더링하지 않는다 (관리자 페이지에서 등록)
export default function RotationCard() {
  const [rotations, setRotations] = useState<Rotation[]>([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "rotations"), (snap) => {
      setRotations(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Rotation)
      );
    });
    return unsubscribe;
  }, []);

  if (rotations.length === 0) return null;

  const now = new Date();
  const sorted = [...rotations].sort((a, b) =>
    a.title.localeCompare(b.title, "ko")
  );

  return (
    <section className="mt-6 rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <h2 className="border-b border-gray-200 px-4 py-3 font-semibold text-gray-900 dark:border-gray-800 dark:text-gray-100">
        담당 순번
      </h2>
      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((r) => {
          const cur = currentAssignee(r, now);
          const next = nextAssignee(r, now);
          return (
            <div
              key={r.id}
              className="rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50"
            >
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {r.title}
              </p>
              <p className="mt-1 text-lg font-semibold text-blue-700 dark:text-blue-400">
                {cur ?? "-"}
              </p>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                다음: {next ?? "-"} ·{" "}
                {r.intervalWeeks > 1 ? `${r.intervalWeeks}주마다` : "매주"}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
