"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  createUserWithEmailAndPassword,
  GithubAuthProvider,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  User,
} from "firebase/auth";
import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { notifyJoinRequest } from "@/lib/notifyJoin";
import { UserProfile } from "@/types";

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  // 소셜 로그인 진행 중(팝업~users 문서 확인/생성 완료 전) 여부.
  // 로그인 페이지가 이 동안 리다이렉트를 보류해 오류 메시지 유실을 막는다.
  socialSignInPending: boolean;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  logIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithGithub: () => Promise<void>;
  logOut: () => Promise<void>;
}

// 사용자에게 그대로 보여줘도 되는 안내 메시지를 담는 소셜 로그인 오류.
// SDK 내부 오류의 영어 원문이 화면에 노출되는 것을 막기 위해 구분한다.
export class SocialSignInError extends Error {}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [socialSignInPending, setSocialSignInPending] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        setProfile(null);
        setLoading(false);
      } else {
        // 프로필 스냅샷이 도착할 때까지 로딩 상태 유지
        setLoading(true);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(
      doc(db, "users", user.uid),
      (snap) => {
        setProfile(
          snap.exists()
            ? ({ uid: snap.id, ...snap.data() } as UserProfile)
            : null
        );
        setLoading(false);
      },
      () => {
        setProfile(null);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [user]);

  const signUp = async (name: string, email: string, password: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    // 신규 가입자는 항상 member/pending으로 시작 (관리자 승인 후 사용 가능)
    await setDoc(doc(db, "users", cred.user.uid), {
      name,
      // 보안규칙이 email == Auth 토큰 이메일을 요구하므로 Auth가 정규화한 값을 저장
      email: cred.user.email,
      role: "member",
      status: "pending",
      createdAt: serverTimestamp(),
    });
    notifyJoinRequest(cred.user);
  };

  const logIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  // 소셜 로그인 첫 사용 시 승인 대기(users) 문서를 자동 생성한다.
  // 문서 확인/생성에 실패한 채 Auth 세션만 남으면 관리자 승인 목록에 나타나지 않는
  // 유령 계정이 되므로, 실패 시 반드시 로그아웃 후 재시도를 안내한다.
  const ensureUserDoc = async (u: User) => {
    const ref = doc(db, "users", u.uid);
    try {
      const snap = await getDoc(ref);
      if (snap.exists()) return;
    } catch {
      await signOut(auth);
      throw new SocialSignInError(
        "가입 정보 확인에 실패했습니다. 네트워크 상태를 확인한 뒤 다시 로그인해주세요."
      );
    }
    if (!u.email) {
      // 보안 규칙이 email == Auth 토큰 이메일을 요구하므로 이메일 없이는 가입 불가
      await signOut(auth);
      throw new SocialSignInError(
        "소셜 계정에서 이메일을 가져올 수 없습니다. GitHub 이메일 공개 설정을 확인하거나 다른 방법으로 가입해주세요."
      );
    }
    try {
      await setDoc(ref, {
        name: u.displayName || u.email.split("@")[0],
        email: u.email,
        role: "member",
        status: "pending",
        createdAt: serverTimestamp(),
      });
    } catch {
      await signOut(auth);
      throw new SocialSignInError(
        "가입 신청 저장에 실패했습니다. 네트워크 상태를 확인한 뒤 다시 로그인해주세요."
      );
    }
    notifyJoinRequest(u);
  };

  const signInWithGoogle = async () => {
    setSocialSignInPending(true);
    try {
      const cred = await signInWithPopup(auth, new GoogleAuthProvider());
      await ensureUserDoc(cred.user);
    } finally {
      setSocialSignInPending(false);
    }
  };

  const signInWithGithub = async () => {
    setSocialSignInPending(true);
    try {
      const cred = await signInWithPopup(auth, new GithubAuthProvider());
      await ensureUserDoc(cred.user);
    } finally {
      setSocialSignInPending(false);
    }
  };

  const logOut = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        socialSignInPending,
        signUp,
        logIn,
        signInWithGoogle,
        signInWithGithub,
        logOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth는 AuthProvider 안에서만 사용할 수 있습니다.");
  }
  return ctx;
}
