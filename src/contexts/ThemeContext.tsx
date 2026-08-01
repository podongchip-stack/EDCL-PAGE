"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

export type ThemePreference = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "edcl-theme";

interface ThemeContextValue {
  preference: ThemePreference;
  setPreference: (next: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveDark(pref: ThemePreference): boolean {
  if (pref === "dark") return true;
  if (pref === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(pref: ThemePreference) {
  document.documentElement.classList.toggle("dark", resolveDark(pref));
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // 초기 클래스 적용은 layout의 인라인 스크립트가 하이드레이션 전에 처리한다.
  const [preference, setPreferenceState] = useState<ThemePreference>("system");

  useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      setPreferenceState(stored);
    }
  }, []);

  // 시스템 설정을 따르는 동안 OS 테마가 바뀌면 즉시 반영한다.
  useEffect(() => {
    if (preference !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [preference]);

  const setPreference = (next: ThemePreference) => {
    setPreferenceState(next);
    localStorage.setItem(THEME_STORAGE_KEY, next);
    applyTheme(next);
  };

  return (
    <ThemeContext.Provider value={{ preference, setPreference }}>
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
