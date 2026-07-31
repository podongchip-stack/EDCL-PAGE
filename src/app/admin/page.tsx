"use client";

import { useEffect, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import AuthGuard from "@/components/AuthGuard";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { formatDate, tsToDate } from "@/lib/dates";
import { UserProfile, UserRole } from "@/types";

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "관리자",
  member: "구성원",
};

interface Feedback {
  type: "success" | "error";
  text: string;
}

function joinedAtText(u: UserProfile): string {
  const d = tsToDate(u.createdAt);
  return d ? formatDate(d) : "-";
}

function AdminContent() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [confirmUid, setConfirmUid] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "users"),
      (snap) => {
        const list = snap.docs.map(
          (d) => ({ uid: d.id, ...d.data() }) as UserProfile
        );
        // 가입일 오름차순 (createdAt이 아직 없는 문서는 뒤로)
        list.sort((a, b) => {
          const ta = a.createdAt ? a.createdAt.toMillis() : Number.MAX_SAFE_INTEGER;
          const tb = b.createdAt ? b.createdAt.toMillis() : Number.MAX_SAFE_INTEGER;
          return ta - tb;
        });
        setUsers(list);
        setLoadError(null);
        setLoadingUsers(false);
      },
      (err) => {
        setLoadError(`구성원 목록을 불러오지 못했습니다: ${err.message}`);
        setLoadingUsers(false);
      }
    );
    return unsubscribe;
  }, []);

  const pendingUsers = users.filter((u) => u.status === "pending");
  const approvedUsers = users.filter((u) => u.status === "approved");

  const approve = async (target: UserProfile) => {
    setBusyUid(target.uid);
    setFeedback(null);
    try {
      await updateDoc(doc(db, "users", target.uid), { status: "approved" });
      setFeedback({
        type: "success",
        text: `${target.name} 님의 가입을 승인했습니다.`,
      });
    } catch (err) {
      setFeedback({
        type: "error",
        text: `승인에 실패했습니다: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setBusyUid(null);
    }
  };

  const removeUser = async (target: UserProfile, actionLabel: string) => {
    setBusyUid(target.uid);
    setFeedback(null);
    try {
      await deleteDoc(doc(db, "users", target.uid));
      setFeedback({
        type: "success",
        text: `${target.name} 님을 ${actionLabel}했습니다.`,
      });
    } catch (err) {
      setFeedback({
        type: "error",
        text: `${actionLabel}에 실패했습니다: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setBusyUid(null);
      setConfirmUid(null);
    }
  };

  const changeRole = async (target: UserProfile, role: UserRole) => {
    if (target.role === role) return;
    setBusyUid(target.uid);
    setFeedback(null);
    try {
      await updateDoc(doc(db, "users", target.uid), { role });
      setFeedback({
        type: "success",
        text: `${target.name} 님의 역할을 ${ROLE_LABELS[role]}(으)로 변경했습니다.`,
      });
    } catch (err) {
      setFeedback({
        type: "error",
        text: `역할 변경에 실패했습니다: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setBusyUid(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold">관리자</h1>
      <p className="mt-1 text-sm text-gray-500">
        가입 승인과 구성원 역할을 관리합니다.
      </p>

      {feedback && (
        <div
          className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
            feedback.type === "success"
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {feedback.text}
        </div>
      )}

      {loadError && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {/* 승인 대기 */}
      <section className="mt-6">
        <h2 className="text-lg font-semibold">
          승인 대기{" "}
          <span className="text-sm font-normal text-gray-500">
            {pendingUsers.length}명
          </span>
        </h2>
        <div className="mt-3 space-y-3">
          {loadingUsers ? (
            <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-sm text-gray-500 shadow-sm">
              불러오는 중...
            </div>
          ) : pendingUsers.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-sm text-gray-500 shadow-sm">
              승인 대기 중인 신청이 없습니다.
            </div>
          ) : (
            pendingUsers.map((u) => (
              <div
                key={u.uid}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium text-gray-900">{u.name}</p>
                  <p className="truncate text-sm text-gray-500">
                    {u.email} · 가입일 {joinedAtText(u)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {confirmUid === u.uid ? (
                    <>
                      <button
                        onClick={() => removeUser(u, "거절")}
                        disabled={busyUid === u.uid}
                        className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                      >
                        정말 거절
                      </button>
                      <button
                        onClick={() => setConfirmUid(null)}
                        disabled={busyUid === u.uid}
                        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50"
                      >
                        취소
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => approve(u)}
                        disabled={busyUid === u.uid}
                        className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                      >
                        승인
                      </button>
                      <button
                        onClick={() => setConfirmUid(u.uid)}
                        disabled={busyUid === u.uid}
                        className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                      >
                        거절
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* 구성원 */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">
          구성원{" "}
          <span className="text-sm font-normal text-gray-500">
            {approvedUsers.length}명
          </span>
        </h2>
        <div className="mt-3 rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500">
                  <th className="px-4 py-3 font-medium">이름</th>
                  <th className="px-4 py-3 font-medium">이메일</th>
                  <th className="px-4 py-3 font-medium">역할</th>
                  <th className="px-4 py-3 font-medium">가입일</th>
                  <th className="px-4 py-3 font-medium">관리</th>
                </tr>
              </thead>
              <tbody>
                {loadingUsers ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                      불러오는 중...
                    </td>
                  </tr>
                ) : approvedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                      구성원이 없습니다.
                    </td>
                  </tr>
                ) : (
                  approvedUsers.map((u) => {
                    const isSelf = u.uid === user?.uid;
                    return (
                      <tr
                        key={u.uid}
                        className="border-b border-gray-100 last:border-b-0"
                      >
                        <td className="px-4 py-3 font-medium text-gray-900">
                          <span className="flex items-center gap-2">
                            {u.name}
                            {isSelf && (
                              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                                본인
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{u.email}</td>
                        <td className="px-4 py-3">
                          <select
                            value={u.role}
                            onChange={(e) =>
                              changeRole(u, e.target.value as UserRole)
                            }
                            disabled={isSelf || busyUid === u.uid}
                            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                          >
                            <option value="member">{ROLE_LABELS.member}</option>
                            <option value="admin">{ROLE_LABELS.admin}</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {joinedAtText(u)}
                        </td>
                        <td className="px-4 py-3">
                          {confirmUid === u.uid ? (
                            <span className="flex items-center gap-2">
                              <button
                                onClick={() => removeUser(u, "삭제")}
                                disabled={busyUid === u.uid}
                                className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                              >
                                정말 삭제
                              </button>
                              <button
                                onClick={() => setConfirmUid(null)}
                                disabled={busyUid === u.uid}
                                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50"
                              >
                                취소
                              </button>
                            </span>
                          ) : (
                            <button
                              onClick={() => setConfirmUid(u.uid)}
                              disabled={isSelf || busyUid === u.uid}
                              className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-300 disabled:hover:bg-white"
                            >
                              삭제
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <p className="mt-6 text-xs text-gray-500">
        거절/삭제는 구성원 정보(users 문서)만 삭제합니다. 로그인 계정(Firebase
        Auth)은 Firebase Console &gt; Authentication에서 별도로 삭제하세요.
      </p>
    </div>
  );
}

export default function AdminPage() {
  return (
    <AuthGuard requireAdmin>
      <AdminContent />
    </AuthGuard>
  );
}
