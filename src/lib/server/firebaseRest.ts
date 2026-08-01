// 서버 라우트 전용 Firebase REST 헬퍼.
// 서비스 계정 없이 사용자의 ID 토큰만으로 신원·권한을 검증하기 위해
// Identity Toolkit(accounts:lookup)과 Firestore REST API를 직접 호출한다.
// Firestore REST는 보안규칙을 그대로 적용하므로 서버가 권한을 넘어서 읽을 수 없다.

export interface VerifiedUser {
  uid: string;
  email: string;
  name: string;
}

// 클라이언트(src/lib/firebase.ts)와 동일한 규칙으로 서버에서 Firebase 설정을 읽는다
// (PROJECT_ID 환경변수 누락 시 authDomain에서 유도하는 폴백 포함)
export function serverFirebaseConfig(): {
  apiKey: string;
  projectId: string;
} | null {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) return null;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "";
  const projectId =
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    (authDomain.endsWith(".firebaseapp.com")
      ? authDomain.slice(0, -".firebaseapp.com".length)
      : "");
  if (!projectId) return null;
  return { apiKey, projectId };
}

export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
}

// ID 토큰을 검증하고 토큰 주인의 uid/email/name을 돌려준다 (유효하지 않으면 null)
export async function verifyIdToken(
  idToken: string
): Promise<VerifiedUser | null> {
  const config = serverFirebaseConfig();
  if (!config) return null;
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${config.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
        cache: "no-store",
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      users?: { localId?: string; email?: string; displayName?: string }[];
    };
    const user = data.users?.[0];
    if (!user?.localId) return null;
    return {
      uid: user.localId,
      email: user.email || "",
      name: user.displayName || user.email || user.localId,
    };
  } catch {
    return null;
  }
}

// Firestore REST로 문서 하나를 읽어 문자열 필드만 평탄화해서 돌려준다.
// 사용자의 ID 토큰으로 호출하므로 보안규칙이 그대로 적용된다.
// 문서가 없거나 읽기 권한이 없으면 null.
export async function getDocStringFields(
  path: string,
  idToken: string
): Promise<Record<string, string> | null> {
  const config = serverFirebaseConfig();
  if (!config) return null;
  try {
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/${path}`,
      {
        headers: { Authorization: `Bearer ${idToken}` },
        cache: "no-store",
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      fields?: Record<string, { stringValue?: string }>;
    };
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(data.fields ?? {})) {
      if (typeof value.stringValue === "string") out[key] = value.stringValue;
    }
    return out;
  } catch {
    return null;
  }
}

// 요청 헤더의 ID 토큰이 "승인된 구성원"의 것인지 확인한다.
// 통과하면 검증된 사용자 정보(role 포함)와 토큰을, 아니면 null을 돌려준다.
export async function verifyApprovedMember(
  request: Request
): Promise<(VerifiedUser & { idToken: string; role: string }) | null> {
  const idToken = bearerToken(request);
  if (!idToken) return null;
  const caller = await verifyIdToken(idToken);
  if (!caller) return null;
  const userDoc = await getDocStringFields(`users/${caller.uid}`, idToken);
  if (!userDoc || userDoc.status !== "approved") return null;
  return { ...caller, idToken, role: userDoc.role || "member" };
}
