import { User } from "firebase/auth";

// 가입 신청 직후 관리자 이메일 알림을 요청한다 (fire-and-forget).
// 서버에 Resend가 설정돼 있지 않으면 조용히 건너뛰며,
// 어떤 실패도 가입 흐름에 영향을 주지 않는다.
export function notifyJoinRequest(user: User): void {
  void (async () => {
    try {
      const idToken = await user.getIdToken();
      await fetch("/api/notify-join", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      });
    } catch {
      // 알림 실패는 무시 — 관리자 페이지에서 여전히 신청을 확인할 수 있다
    }
  })();
}
