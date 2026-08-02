"use client";

import { KeyboardEvent, ReactNode, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

const SIZES = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-2xl",
} as const;

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// 열려 있는 모달 수. 중첩해서 열려도 마지막 하나가 닫힐 때만 스크롤 잠금을 푼다.
let openCount = 0;
let restoreOverflow = "";

interface ModalProps {
  onClose: () => void;
  children: ReactNode;
  /** 헤더에 표시할 제목. bare 모드에서는 무시된다. */
  title?: ReactNode;
  /** 데스크톱 최대 너비 (모바일은 항상 화면 폭을 채우는 바텀시트) */
  size?: keyof typeof SIZES;
  /** 데스크톱 세로 정렬. 검색 팔레트처럼 위쪽에 붙이려면 "top" */
  align?: "center" | "top";
  /** 헤더와 기본 여백 없이 children이 패널 내부를 전부 그린다 */
  bare?: boolean;
}

// 데스크톱은 가운데 뜨는 대화상자, 모바일은 아래에서 올라오는 바텀시트로 보여준다.
export default function Modal({
  onClose,
  children,
  title,
  size = "md",
  align = "center",
  bare = false,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (openCount === 0) {
      restoreOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    openCount += 1;
    return () => {
      openCount -= 1;
      if (openCount === 0) document.body.style.overflow = restoreOverflow;
    };
  }, []);

  // 열릴 때 포커스를 패널 안으로 옮기고, 닫히면 열기 전 요소로 되돌린다.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    // autoFocus가 붙은 입력이 이미 포커스를 가져갔으면 건드리지 않는다
    if (panel && !panel.contains(document.activeElement)) panel.focus();
    return () => previous?.focus?.();
  }, []);

  // Tab이 패널 밖으로 나가지 않도록 순환시킨다
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab") return;
    const panel = panelRef.current;
    if (!panel) return;
    const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  // 모달은 사용자 조작 이후에만 렌더링되므로 서버에서는 그릴 것이 없다
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className={`animate-backdrop-in fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:p-4 ${
        align === "top" ? "sm:items-start sm:pt-[12vh]" : "sm:items-center"
      }`}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        className={`animate-sheet-in sm:animate-modal-in flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-gray-200 bg-white shadow-xl focus:outline-none sm:max-h-[90vh] sm:rounded-lg dark:border-gray-800 dark:bg-gray-900 ${SIZES[size]}`}
      >
        {/* 바텀시트 손잡이 (모바일 전용) */}
        <div
          aria-hidden
          className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-gray-300 sm:hidden dark:bg-gray-700"
        />
        {bare ? (
          children
        ) : (
          <>
            <div className="flex shrink-0 items-center justify-between gap-3 px-5 pt-4 pb-3 sm:px-6 sm:pt-5">
              <h2
                id={titleId}
                className="text-lg font-bold text-gray-900 dark:text-gray-100"
              >
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 rounded-md px-2 py-1 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              >
                닫기
              </button>
            </div>
            <div className="overflow-y-auto px-5 pb-5 sm:px-6 sm:pb-6">
              {children}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
