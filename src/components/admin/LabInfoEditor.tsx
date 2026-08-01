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
  const [research, setResearch] = useState("");
  const [researchEn, setResearchEn] = useState("");
  const [topics, setTopics] = useState("");
  const [topicsEn, setTopicsEn] = useState("");
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
          setResearch(typeof data.research === "string" ? data.research : "");
          setResearchEn(
            typeof data.researchEn === "string" ? data.researchEn : ""
          );
          setTopics(typeof data.topics === "string" ? data.topics : "");
          setTopicsEn(typeof data.topicsEn === "string" ? data.topicsEn : "");
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
        research: research.trim(),
        researchEn: researchEn.trim(),
        topics: topics.trim(),
        topicsEn: topicsEn.trim(),
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
        로그인하지 않은 방문자에게 보이는 홈 화면의 문구입니다. 비워둔 항목은
        기본 문구(BMS 소개 초안)가 대신 표시됩니다.
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
        <div>
          <label
            htmlFor="lab-research"
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            연구 소개 본문
          </label>
          <textarea
            id="lab-research"
            value={research}
            onChange={(e) => setResearch(e.target.value)}
            rows={6}
            disabled={saving}
            placeholder="BMS 연구에 대한 소개를 여러 문단으로 작성하세요. 비우면 기본 초안이 표시됩니다."
            className={inputClass}
          />
        </div>
        <div>
          <label
            htmlFor="lab-research-en"
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            연구 소개 본문 (영문)
          </label>
          <textarea
            id="lab-research-en"
            value={researchEn}
            onChange={(e) => setResearchEn(e.target.value)}
            rows={6}
            disabled={saving}
            placeholder="English research description (선택)"
            className={inputClass}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor="lab-topics"
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              연구 키워드
            </label>
            <input
              id="lab-topics"
              type="text"
              value={topics}
              onChange={(e) => setTopics(e.target.value)}
              disabled={saving}
              placeholder="쉼표로 구분 (예: SOC/SOH 추정, 셀 밸런싱)"
              className={inputClass}
            />
          </div>
          <div>
            <label
              htmlFor="lab-topics-en"
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              연구 키워드 (영문)
            </label>
            <input
              id="lab-topics-en"
              type="text"
              value={topicsEn}
              onChange={(e) => setTopicsEn(e.target.value)}
              disabled={saving}
              placeholder="Comma-separated (optional)"
              className={inputClass}
            />
          </div>
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
