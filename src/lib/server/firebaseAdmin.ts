import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

// FIREBASE_SERVICE_ACCOUNT_KEY(서비스 계정 JSON 원문 또는 base64 인코딩)가 등록된
// 경우에만 admin SDK를 초기화한다. 미등록이면 null — 호출부는 "미구성" 응답으로
// 처리하고 기존(수동) 동작을 유지한다.

interface AdminServices {
  auth: Auth;
  db: Firestore;
}

let cached: AdminServices | null | undefined;

function parseServiceAccount(raw: string): Record<string, unknown> | null {
  const tryParse = (text: string) => {
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      return null;
    }
  };
  return (
    tryParse(raw) ?? tryParse(Buffer.from(raw, "base64").toString("utf8"))
  );
}

export function getAdminServices(): AdminServices | null {
  if (cached !== undefined) return cached;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    cached = null;
    return cached;
  }
  const serviceAccount = parseServiceAccount(raw);
  if (!serviceAccount) {
    console.error(
      "FIREBASE_SERVICE_ACCOUNT_KEY 파싱 실패: 서비스 계정 JSON(또는 base64) 형식인지 확인하세요."
    );
    cached = null;
    return cached;
  }
  const app =
    getApps().length > 0
      ? getApps()[0]
      : initializeApp({
          credential: cert(serviceAccount as Parameters<typeof cert>[0]),
        });
  cached = { auth: getAuth(app), db: getFirestore(app) };
  return cached;
}
