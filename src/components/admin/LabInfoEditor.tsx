"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500";

// 공개 랜딩 페이지(siteContent/labInfo)의 소개 문구를 편집한다
export default function LabInfoEditor() {
  const [intro, setIntro] = useState("");
  const [introEn, setIntroEn] = useState("");
  const [professor, setProfessor] = useState("");
  const [contact, setContact] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    getDoc(doc(db, "siteContent", "labInfo"))
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setIntro(typeof data.intro === "string" ? data.intro : "");
          setIntroEn(typeof data.introEn === "string" ? data.introEn : "");
          setProfessor(
            typeof data.professor === "string" ? data.professor : ""
          );
          setContact(typeof data.contact === "string" ? data.contact : "");
        }
      })
      .catch(() => {
        // 아직 등록 전 — 빈 값으로 시작
      });
  }, []);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setMessage(null);
    try {
      await setDoc(doc(db, "siteContent", "labInfo"), {
        intro: intro.trim(),
        introEn: introEn.trim(),
        professor: professor.trim(),
        contact: contact.trim(),
      });
      setMessage({ type: "success", text: "저장했습니다. 홈 화면에 반영됩니다." });
    } catch {
      setMessage({
        type: "error",
        text: "저장에 실패했습니다. 잠시 후 다시 시도하세요.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">연구실 소개 (공개 홈)</h2>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        로그인하지 않은 방문자에게 보이는 홈 화면의 소개 문구입니다.
      </p>
      <div className="mt-3 space-y-3 rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div>
          <label
            htmlFor="lab-intro"
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            소개 문구
          </label>
          <textarea
            id="lab-intro"
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            rows={4}
            disabled={saving}
            placeholder="연구실을 소개하는 문구를 입력하세요."
            className={inputClass}
          />
        </div>
        <div>
          <label
            htmlFor="lab-intro-en"
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            소개 문구 (영문)
          </label>
          <textarea
            id="lab-intro-en"
            value={introEn}
            onChange={(e) => setIntroEn(e.target.value)}
            rows={4}
            disabled={saving}
            placeholder="English introduction (선택 — 비우면 EN 모드에서도 국문이 표시됩니다)"
            className={inputClass}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor="lab-professor"
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              지도교수
            </label>
            <input
              id="lab-professor"
              type="text"
              value={professor}
              onChange={(e) => setProfessor(e.target.value)}
              disabled={saving}
              placeholder="이름 (선택)"
              className={inputClass}
            />
          </div>
          <div>
            <label
              htmlFor="lab-contact"
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              연락처
            </label>
            <input
              id="lab-contact"
              type="text"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              disabled={saving}
              placeholder="이메일·전화 등 (선택)"
              className={inputClass}
            />
          </div>
        </div>
        {message && (
          <p
            className={`text-sm ${
              message.type === "success"
                ? "text-green-700 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {message.text}
          </p>
        )}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </section>
  );
}
