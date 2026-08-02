"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useSyncExternalStore,
} from "react";
import { useAuth } from "@/contexts/AuthContext";

export type ThemePreference = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "edcl-theme";

interface ThemeContextValue {
  preference: ThemePreference;
  setPreference: (next: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// 저장된 설정을 외부 스토어로 구독한다. 서버 렌더에서는 값을 알 수 없어
// 기본값을 쓰고, 하이드레이션 이후 실제 저장값으로 교체된다.
const listeners = new Set<() => void>();
let snapshot: ThemePreference | null = null;

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function getSnapshot(): ThemePreference {
  if (snapshot === null) {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    snapshot =
      stored === "light" || stored === "dark" || stored === "system"
        ? stored
        : "system";
  }
  return snapshot;
}

function getServerSnapshot(): ThemePreference {
  return "system";
}

function storePreference(next: ThemePreference) {
  snapshot = next;
  localStorage.setItem(THEME_STORAGE_KEY, next);
  for (const listener of listeners) listener();
}

function resolveDark(pref: ThemePreference): boolean {
  if (pref === "dark") return true;
  if (pref === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(pref: ThemePreference) {
  document.documentElement.classList.toggle("dark", resolveDark(pref));
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const preference = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  // 로그인 전 화면은 어두운 표지 디자인에 맞춰 다크로 고정한다.
  // 인증 확인 중에는 layout의 인라인 스크립트가 정한 초기 테마를 그대로 둬 깜빡임을 막는다.
  const forceDark = !loading && !user;

  useEffect(() => {
    if (loading) return;
    applyTheme(forceDark ? "dark" : preference);
  }, [loading, forceDark, preference]);

  // 시스템 설정을 따르는 동안 OS 테마가 바뀌면 즉시 반영한다.
  useEffect(() => {
    if (forceDark || preference !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [forceDark, preference]);

  return (
    <ThemeContext.Provider
      value={{ preference, setPreference: storePreference }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme은 ThemeProvider 안에서만 사용할 수 있습니다.");
  }
  return ctx;
}
