import {
  bearerToken,
  getDocStringFields,
  verifyIdToken,
} from "@/lib/server/firebaseRest";

// 가입 신청 직후 관리자에게 이메일 알림을 보낸다 (Resend REST API).
// RESEND_API_KEY / JOIN_NOTIFY_EMAIL 미설정이면 아무것도 하지 않는다 —
// 알림은 부가 기능이므로 가입 흐름을 절대 막지 않는다.
// 이름·이메일은 요청 본문이 아니라 검증된 ID 토큰에서 가져와 위조를 막는다.
//
// 남용 방어: users 문서가 pending 상태일 때만 발송(유령 신청 차단)하고,
// 인스턴스 내 uid별 쿨다운 + 시간당 발송 상한으로 반복 호출(메일 폭탄)을 제한한다.
// 서버리스 인스턴스가 바뀌면 카운터가 초기화되지만, Fluid Compute의 인스턴스
// 재사용 덕에 단일 공격 루프는 대부분 같은 인스턴스에서 걸러진다.

const RENOTIFY_COOLDOWN_MS = 10 * 60 * 1000; // uid당 10분에 1건
const HOURLY_CAP = 20; // 인스턴스당 시간당 최대 발송 수
const lastSentByUid = new Map<string, number>();
let windowStart = 0;
let sentInWindow = 0;

function underRateLimit(uid: string): boolean {
  const now = Date.now();
  const last = lastSentByUid.get(uid);
  if (last !== undefined && now - last < RENOTIFY_COOLDOWN_MS) return false;
  if (now - windowStart > 60 * 60 * 1000) {
    windowStart = now;
    sentInWindow = 0;
  }
  if (sentInWindow >= HOURLY_CAP) return false;
  // 맵이 무한히 크지 않도록 오래된 항목을 정리한다
  if (lastSentByUid.size > 500) {
    for (const [key, ts] of lastSentByUid) {
      if (now - ts > RENOTIFY_COOLDOWN_MS) lastSentByUid.delete(key);
    }
  }
  lastSentByUid.set(uid, now);
  sentInWindow += 1;
  return true;
}

export async function POST(request: Request) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = (process.env.JOIN_NOTIFY_EMAIL || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  if (!apiKey || to.length === 0) {
    return Response.json({ sent: false, reason: "not-configured" });
  }

  const idToken = bearerToken(request);
  const caller = idToken ? await verifyIdToken(idToken) : null;
  if (!idToken || !caller) {
    return Response.json(
      { sent: false, reason: "unauthorized" },
      { status: 401 }
    );
  }

  // 실제 가입 신청(users 문서가 pending)일 때만 발송 —
  // Auth 계정만 만들어 승인 목록에 없는 '유령 신청' 메일을 만드는 것을 막는다
  const userDoc = await getDocStringFields(`users/${caller.uid}`, idToken);
  if (!userDoc || userDoc.status !== "pending") {
    return Response.json({ sent: false, reason: "not-pending" });
  }

  if (!underRateLimit(caller.uid)) {
    return Response.json(
      { sent: false, reason: "rate-limited" },
      { status: 429 }
    );
  }

  // 이름은 사용자가 임의로 바꿀 수 있는 값이다 — 개행·URL을 제거하고 길이를 제한
  const name =
    caller.name
      .replace(/[\r\n]+/g, " ")
      .replace(/https?:\/\//gi, "")
      .slice(0, 100) || "(이름 없음)";
  const adminUrl = `${new URL(request.url).origin}/admin`;
  const from =
    process.env.RESEND_FROM_EMAIL || "EDCL 홈페이지 <onboarding@resend.dev>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: `[EDCL] 새 가입 신청: ${name}`,
      text: [
        "연구실 홈페이지에 새 가입 신청이 들어왔습니다.",
        "",
        `이름(가입자 입력): ${name}`,
        `이메일: ${caller.email || "(없음)"}`,
        "",
        "관리자 페이지에서 승인/거절할 수 있습니다:",
        adminUrl,
      ].join("\n"),
    }),
  });
  if (!res.ok) {
    return Response.json(
      { sent: false, reason: "send-failed" },
      { status: 502 }
    );
  }
  return Response.json({ sent: true });
}
