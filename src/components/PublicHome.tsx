"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { LabInfo } from "@/types";

export default function PublicHome() {
  const [info, setInfo] = useState<LabInfo | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, "siteContent", "labInfo"),
      (snap) => {
        setInfo(snap.exists() ? (snap.data() as LabInfo) : null);
        setLoaded(true);
      },
      () => setLoaded(true)
    );
    return unsubscribe;
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <section className="text-center">
        <h1 className="text-4xl font-bold text-blue-700 dark:text-blue-400">
          EDCL LAB
        </h1>
        {!loaded ? (
          <div className="mx-auto mt-6 max-w-2xl space-y-2">
            <div className="h-4 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
            <div className="mx-auto h-4 w-2/3 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
          </div>
        ) : (
          <p className="mx-auto mt-6 max-w-2xl whitespace-pre-wrap break-words text-base leading-relaxed text-gray-700 dark:text-gray-300">
            {info?.intro ? info.intro : "연구실 소개가 준비 중입니다."}
          </p>
        )}
        {info?.professor && (
          <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
            지도교수: {info.professor}
          </p>
        )}
        {info?.contact && (
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            연락처: {info.contact}
          </p>
        )}
      </section>

      <section className="mx-auto mt-12 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
        <Link
          href="/members"
          className="rounded-lg border border-gray-200 bg-white p-6 text-center shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50/50 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-blue-800 dark:hover:bg-blue-950/30"
        >
          <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
            구성원
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            연구실 멤버를 소개합니다
          </p>
        </Link>
        <Link
          href="/publications"
          className="rounded-lg border border-gray-200 bg-white p-6 text-center shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50/50 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-blue-800 dark:hover:bg-blue-950/30"
        >
          <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
            논문
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            연구 성과와 출판물
          </p>
        </Link>
        <Link
          href="/login"
          className="rounded-lg border border-blue-600 bg-blue-600 p-6 text-center shadow-sm transition-colors hover:bg-blue-700"
        >
          <p className="text-base font-semibold text-white">구성원 로그인</p>
          <p className="mt-1 text-sm text-blue-100">
            일정·프로젝트·자료 공유
          </p>
        </Link>
      </section>
    </div>
  );
}
