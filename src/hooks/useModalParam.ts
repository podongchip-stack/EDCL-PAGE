"use client";

import { useCallback, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * 모달 열림 상태를 URL 쿼리(?key=value)에 동기화한다.
 *
 * 열 때는 history에 기록을 쌓아 뒤로가기로 모달이 닫히게 하고, 닫을 때는
 * 이 훅이 직접 연 경우에만 back으로 되돌려 기록이 계속 늘어나지 않게 한다.
 * 검색 딥링크처럼 쿼리를 가진 채 진입한 경우에는 back이 사이트 밖으로
 * 나가버리므로 쿼리만 지우는 replace를 쓴다.
 */
export function useModalParam(key: string) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const value = searchParams.get(key);
  const pushedRef = useRef(false);

  const open = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(key, next);
      pushedRef.current = true;
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [key, pathname, router, searchParams]
  );

  const close = useCallback(() => {
    if (pushedRef.current) {
      pushedRef.current = false;
      router.back();
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.delete(key);
    const rest = params.toString();
    router.replace(rest ? `${pathname}?${rest}` : pathname, { scroll: false });
  }, [key, pathname, router, searchParams]);

  return { value, open, close };
}
