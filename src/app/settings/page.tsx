"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { updateProfile } from "firebase/auth";
import {
  collection,
  doc,
  DocumentReference,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import AuthGuard from "@/components/AuthGuard";
import { useAuth } from "@/contexts/AuthContext";
import { ThemePreference, useTheme } from "@/contexts/ThemeContext";
import { auth, db } from "@/lib/firebase";

// 작업 담당자·일정/공지/자료 작성자로 저장된 비정규화 이름도 함께 갱신한다.
// (공지는 관리자만 update 가능하므로 관리자일 때만 갱신)
async function propagateName(uid: string, name: string, isAdmin: boolean) {
  const updates: { ref: DocumentReference; data: Record<string, string> }[] =
    [];
  const [taskSnap, eventSnap, resourceSnap, bookingSnap, noticeSnap] =
    await Promise.all([
      getDocs(query(collection(db, "tasks"), where("assigneeUid", "==", uid))),
      getDocs(query(collection(db, "events"), where("createdBy", "==", uid))),
      getDocs(
        query(collection(db, "resources"), where("createdBy", "==", uid))
      ),
      getDocs(query(collection(db, "bookings"), where("createdBy", "==", uid))),
      isAdmin
        ? getDocs(
            query(collection(db, "notices"), where("createdBy", "==", uid))
          )
        : Promise.resolve(null),
    ]);
  taskSnap.forEach((d) =>
    updates.push({ ref: d.ref, data: { assigneeName: name } })
  );
  eventSnap.forEach((d) =>
    updates.push({ ref: d.ref, data: { createdByName: name } })
  );
  resourceSnap.forEach((d) =>
    updates.push({ ref: d.ref, data: { createdByName: name } })
  );
  bookingSnap.forEach((d) =>
    updates.push({ ref: d.ref, data: { createdByName: name } })
  );
  noticeSnap?.forEach((d) =>
    updates.push({ ref: d.ref, data: { createdByName: name } })
  );
  // Firestore batch는 500건 제한이므로 나눠서 커밋
  for (let i = 0; i < updates.length; i += 450) {
    const batch = writeBatch(db);
    for (const u of updates.slice(i, i + 450)) {
      batch.update(u.ref, u.data);
    }
    await batch.commit();
  }
  // 공개 프로필이 있으면 이름도 맞춰준다 (없으면 무시)
  try {
    await updateDoc(doc(db, "publicProfiles", uid), { name });
  } catch {
    // 공개 프로필 미등록 상태 — 갱신할 것이 없다
  }
}

const THEME_OPTIONS: {
  value: ThemePreference;
  label: string;
  description: string;
}[] = [
  {
    value: "system",
    label: "시스템 설정",
    description: "OS의 라이트/다크 설정을 자동으로 따릅니다.",
  },
  {
    value: "light",
    label: "라이트",
    description: "항상 밝은 화면으로 표시합니다.",
  },
  {
    value: "dark",
    label: "다크",
    description: "항상 어두운 화면으로 표시합니다.",
  },
];

function SettingsContent() {
  const { user, profile } = useAuth();
  const { preference, setPreference } = useTheme();

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const [profileVisible, setProfileVisible] = useState(false);
  const [position, setPosition] = useState("");
  const [interests, setInterests] = useState("");
  const [isAlumni, setIsAlumni] = useState(false);
  const [savingPublic, setSavingPublic] = useState(false);
  const [publicMsg, setPublicMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, "publicProfiles", user.uid))
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setProfileVisible(data.visible === true);
          setPosition(typeof data.position === "string" ? data.position : "");
          setInterests(
            typeof data.interests === "string" ? data.interests : ""
          );
          setIsAlumni(data.isAlumni === true);
        }
      })
      .catch(() => {
        // 아직 등록 전이거나 일시 오류 — 기본값 유지
      });
  }, [user]);

  const savePublicProfile = async () => {
    if (!user || !profile || savingPublic) return;
    setSavingPublic(true);
    setPublicMsg(null);
    try {
      await setDoc(doc(db, "publicProfiles", user.uid), {
        name: profile.name,
        position: position.trim(),
        interests: interests.trim(),
        isAlumni,
        visible: profileVisible,
        updatedAt: serverTimestamp(),
      });
      setPublicMsg({
        type: "success",
        text: profileVisible
          ? "저장했습니다. 구성원 페이지에 공개됩니다."
          : "저장했습니다. 구성원 페이지에는 표시되지 않습니다.",
      });
    } catch {
      setPublicMsg({
        type: "error",
        text: "저장에 실패했습니다. 잠시 후 다시 시도해주세요.",
      });
    } finally {
      setSavingPublic(false);
    }
  };

  const startNameEdit = () => {
    setNameInput(profile?.name ?? "");
    setNameError(null);
    setEditingName(true);
  };

  const saveName = async () => {
    if (!user || savingName) return;
    const trimmed = nameInput.trim();
    if (!trimmed) {
      setNameError("이름을 입력해주세요.");
      return;
    }
    setSavingName(true);
    setNameError(null);
    try {
      await updateDoc(doc(db, "users", user.uid), { name: trimmed });
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: trimmed });
      }
      await propagateName(user.uid, trimmed, profile?.role === "admin");
      setEditingName(false);
    } catch {
      setNameError("이름 변경에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setSavingName(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          설정
        </h1>
        <Link
          href="/help"
          className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          도움말 →
        </Link>
      </div>

      <section className="mt-6 rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-800">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">
            화면 테마
          </h2>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            이 브라우저의 로그인 후 화면에만 적용됩니다. 로그아웃 상태에서는
            항상 어두운 화면으로 표시됩니다.
          </p>
        </div>
        <div className="space-y-2 p-5">
          {THEME_OPTIONS.map((opt) => {
            const selected = preference === opt.value;
            return (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
                  selected
                    ? "border-blue-600 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/40"
                    : "border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800/60"
                }`}
              >
                <input
                  type="radio"
                  name="theme"
                  value={opt.value}
                  checked={selected}
                  onChange={() => setPreference(opt.value)}
                  className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="min-w-0">
                  <span
                    className={`block text-sm font-medium ${
                      selected
                        ? "text-blue-700 dark:text-blue-300"
                        : "text-gray-900 dark:text-gray-100"
                    }`}
                  >
                    {opt.label}
                  </span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400">
                    {opt.description}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-800">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">
            내 계정
          </h2>
        </div>
        <dl className="space-y-3 p-5 text-sm">
          <div className="flex items-center gap-4">
            <dt className="w-16 shrink-0 text-gray-500 dark:text-gray-400">
              이름
            </dt>
            <dd className="flex min-w-0 flex-1 items-center gap-2">
              {editingName ? (
                <>
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    disabled={savingName}
                    aria-label="이름"
                    className="w-40 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  />
                  <button
                    type="button"
                    onClick={saveName}
                    disabled={savingName}
                    className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                  >
                    {savingName ? "저장 중..." : "저장"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingName(false);
                      setNameError(null);
                    }}
                    disabled={savingName}
                    className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    취소
                  </button>
                </>
              ) : (
                <>
                  <span className="truncate font-medium text-gray-900 dark:text-gray-100">
                    {profile?.name ?? "-"}
                  </span>
                  <button
                    type="button"
                    onClick={startNameEdit}
                    className="text-xs text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
                  >
                    수정
                  </button>
                </>
              )}
            </dd>
          </div>
          {nameError && (
            <div className="text-xs text-red-600 dark:text-red-400">
              {nameError}
            </div>
          )}
          <div className="flex gap-4">
            <dt className="w-16 shrink-0 text-gray-500 dark:text-gray-400">
              이메일
            </dt>
            <dd className="text-gray-700 dark:text-gray-300">
              {profile?.email ?? "-"}
            </dd>
          </div>
          <div className="flex gap-4">
            <dt className="w-16 shrink-0 text-gray-500 dark:text-gray-400">
              역할
            </dt>
            <dd className="text-gray-700 dark:text-gray-300">
              {profile?.role === "admin" ? "관리자" : "구성원"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="mt-6 rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-800">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">
              공개 프로필
            </h2>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              공개를 켜면 로그인 없이 볼 수 있는 구성원 페이지에 표시됩니다.
            </p>
          </div>
          <Link
            href="/members"
            className="shrink-0 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            페이지 보기 →
          </Link>
        </div>
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={profileVisible}
                onChange={(e) => setProfileVisible(e.target.checked)}
                disabled={savingPublic}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              구성원 페이지에 내 프로필 공개
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={isAlumni}
                onChange={(e) => setIsAlumni(e.target.checked)}
                disabled={savingPublic}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              졸업생 (졸업생 섹션에 표시)
            </label>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="profile-position"
                className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                직책/과정
              </label>
              <input
                id="profile-position"
                type="text"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                disabled={savingPublic}
                placeholder="예: 석사과정"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
              />
            </div>
            <div>
              <label
                htmlFor="profile-interests"
                className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                연구 분야
              </label>
              <input
                id="profile-interests"
                type="text"
                value={interests}
                onChange={(e) => setInterests(e.target.value)}
                disabled={savingPublic}
                placeholder="예: 교육공학, AI 리터러시"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
              />
            </div>
          </div>
          {publicMsg && (
            <p
              className={`text-sm ${
                publicMsg.type === "success"
                  ? "text-green-700 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {publicMsg.text}
            </p>
          )}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={savePublicProfile}
              disabled={savingPublic}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {savingPublic ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <AuthGuard>
      <SettingsContent />
    </AuthGuard>
  );
}
