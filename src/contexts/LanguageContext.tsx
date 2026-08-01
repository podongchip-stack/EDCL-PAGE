"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

// 공개 페이지(홈·구성원·논문)의 표시 언어. 내부 도구는 한국어 고정.
export type Language = "ko" | "en";

const STORAGE_KEY = "edcl-lang";

interface LanguageContextValue {
  lang: Language;
  setLang: (next: Language) => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>("ko");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "ko" || stored === "en") {
      setLangState(stored);
    }
  }, []);

  // 스크린리더·브라우저 번역이 올바르게 동작하도록 문서 언어 속성을 맞춘다
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (next: Language) => {
    setLangState(next);
    localStorage.setItem(STORAGE_KEY, next);
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error(
      "useLanguage는 LanguageProvider 안에서만 사용할 수 있습니다."
    );
  }
  return ctx;
}
